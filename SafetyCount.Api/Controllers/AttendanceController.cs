using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SafetyCount.Api.Data;
using SafetyCount.Api.DTOs;
using SafetyCount.Api.Models;
using SafetyCount.Api.Options;
using SafetyCount.Api.Services;

namespace SafetyCount.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttendanceController(
    ApplicationDbContext dbContext,
    IBadgeFileReaderService badgeFileReaderService,
    IBadgeAttendanceService badgeAttendanceService,
    IOptions<BadgeFileSettings> badgeFileSettings) : ControllerBase
{
    /// <summary>
    /// Get attendance for a specific date. If no records exist for that date,
    /// auto-generates records for ALL employees:
    /// - Managers (No Badge Required): Always marked as Present
    /// - Regular Employees: Marked as Present (can be toggled by admin)
    /// Non-working days return an empty list without auto-generating records.
    /// </summary>
    [HttpGet("{date:datetime}")]
    public async Task<IActionResult> GetAttendanceByDate(DateTime date, CancellationToken cancellationToken)
    {
        var targetDate = date.Date;

        var records = await dbContext.DailyAttendances
            .Where(x => x.Date == targetDate)
            .ToListAsync(cancellationToken);

        // Auto-generate only for working days that have no records yet
        if (records.Count == 0 && await IsWorkingDayAsync(targetDate, cancellationToken))
        {
            records = await CreateDefaultAttendancesAsync(targetDate, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        // Load employee names
        var employeeIds = records.Select(r => r.EmployeeId).Distinct().ToList();
        var employeeNames = await ResolveEmployeeNamesAsync(employeeIds, cancellationToken);
        var badgeFlags = await ResolveBadgeRequirementsAsync(employeeIds, cancellationToken);

        var result = records.Select(r => new
        {
            r.Id,
            r.EmployeeId,
            EmployeeName = employeeNames.GetValueOrDefault(r.EmployeeId, "Unknown"),
            r.Date,
            r.IsPresent,
            r.Remark,
            RequiresBadgeSwipe = badgeFlags.GetValueOrDefault(r.EmployeeId, true)
        })
        .OrderBy(r => r.EmployeeId)
        .ToList();

        return Ok(result);
    }

    /// <summary>
    /// Update attendance for a single employee on a specific date.
    /// Employees with RequiresBadgeSwipe = false are always Present and cannot be changed.
    /// </summary>
    [HttpPut("{date:datetime}/{employeeId}")]
    public async Task<IActionResult> UpdateAttendance(
        DateTime date,
        string employeeId,
        [FromBody] MorningAttendanceSubmitDto dto,
        CancellationToken cancellationToken)
    {
        var targetDate = date.Date;

        // Managers (RequiresBadgeSwipe = false) are always Present — reject any change
        // This ensures manager attendance is locked and always shows as Present
        var employee = await dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.EId == employeeId, cancellationToken);
        if (employee != null && !employee.RequiresBadgeSwipe)
            return BadRequest(new { error = "Managers are always marked as Present and cannot be modified." });

        var attendance = await dbContext.DailyAttendances
            .FirstOrDefaultAsync(x => x.Date == targetDate && x.EmployeeId == employeeId, cancellationToken);

        if (attendance is null)
        {
            // Create new record
            attendance = new DailyAttendance
            {
                EmployeeId = employeeId,
                Date = targetDate,
                IsPresent = dto.IsPresent,
                Remark = dto.Remark,
                IsBadgeCrossChecked = false
            };
            dbContext.DailyAttendances.Add(attendance);
        }
        else
        {
            attendance.IsPresent = dto.IsPresent;
            attendance.Remark = dto.Remark;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    /// <summary>
    /// Get working-day status for each date in the given range.
    /// Default: Sunday = non-working; Mon–Sat = working. Overrides stored in DB.
    /// </summary>
    [HttpGet("working-days")]
    public async Task<IActionResult> GetWorkingDays(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        CancellationToken cancellationToken)
    {
        var fromDate = from.Date;
        var toDate = to.Date;

        var overrides = await dbContext.WorkingDays
            .Where(w => w.Date >= fromDate && w.Date <= toDate)
            .ToDictionaryAsync(w => w.Date, w => w.IsWorkingDay, cancellationToken);

        var result = new List<object>();
        for (var d = fromDate; d <= toDate; d = d.AddDays(1))
        {
            var isWorking = overrides.TryGetValue(d, out var ov) ? ov : d.DayOfWeek != DayOfWeek.Sunday;
            result.Add(new { date = d.ToString("yyyy-MM-dd"), isWorkingDay = isWorking });
        }

        return Ok(result);
    }

    /// <summary>
    /// Set working-day status for a specific date (creates or updates the override).
    /// </summary>
    [HttpPut("working-days/{date:datetime}")]
    public async Task<IActionResult> SetWorkingDay(
        DateTime date,
        [FromBody] SetWorkingDayDto dto,
        CancellationToken cancellationToken)
    {
        var targetDate = date.Date;

        var existing = await dbContext.WorkingDays
            .FirstOrDefaultAsync(w => w.Date == targetDate, cancellationToken);

        if (existing is null)
        {
            dbContext.WorkingDays.Add(new WorkingDay { Date = targetDate, IsWorkingDay = dto.IsWorkingDay });
        }
        else
        {
            existing.IsWorkingDay = dto.IsWorkingDay;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { date = targetDate.ToString("yyyy-MM-dd"), isWorkingDay = dto.IsWorkingDay });
    }

    /// <summary>
    /// Get attendance summary for a date range (for History page).
    /// </summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        CancellationToken cancellationToken)
    {
        var fromDate = from.Date;
        var toDate = to.Date;

        var records = await dbContext.DailyAttendances
            .Where(x => x.Date >= fromDate && x.Date <= toDate)
            .GroupBy(x => x.Date)
            .Select(g => new
            {
                Date = g.Key,
                Total = g.Count(),
                PresentCount = g.Count(x => x.IsPresent),
                AbsentCount = g.Count(x => !x.IsPresent)
            })
            .OrderByDescending(x => x.Date)
            .ToListAsync(cancellationToken);

        return Ok(records);
    }

    [HttpPost("morning")]
    public async Task<IActionResult> SubmitMorningAttendance([FromBody] List<MorningAttendanceSubmitDto> attendanceDtos, CancellationToken cancellationToken)
    {
        if (attendanceDtos.Count == 0)
        {
            return BadRequest("Attendance payload cannot be empty.");
        }

        var today = DateTime.Today;
        var employeeIds = attendanceDtos.Select(x => x.EmployeeId).Distinct().ToList();

        var existingAttendances = await dbContext.DailyAttendances
            .Where(x => x.Date == today && employeeIds.Contains(x.EmployeeId))
            .ToDictionaryAsync(x => x.EmployeeId, cancellationToken);

        foreach (var dto in attendanceDtos)
        {
            if (existingAttendances.TryGetValue(dto.EmployeeId, out var attendance))
            {
                attendance.IsPresent = dto.IsPresent;
                attendance.Remark = dto.Remark;
                continue;
            }

            dbContext.DailyAttendances.Add(new DailyAttendance
            {
                EmployeeId = dto.EmployeeId,
                Date = today,
                IsPresent = dto.IsPresent,
                Remark = dto.Remark,
                IsBadgeCrossChecked = false
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPost("internal/crosscheck-badges")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> CrossCheckBadges([FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length == 0)
        {
            return BadRequest("Badge file is empty.");
        }

        var badgeSwipes = await badgeFileReaderService.ParseBadgeSwipeFileAsync(file, cancellationToken);
        var targetDate = BadgeFileNameResolver.ResolveAttendanceDate(file.FileName);
        var updatedCount = await badgeAttendanceService.CrossCheckAsync(badgeSwipes, targetDate, cancellationToken);

        return Ok(new { attendanceDate = targetDate, swipeCount = badgeSwipes.Count, updatedCount });
    }

    [HttpPost("internal/crosscheck-badges/share")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> CrossCheckBadgesFromShare(
        [FromQuery] DateTime? attendanceDate,
        [FromQuery] string? fileName,
        CancellationToken cancellationToken)
    {
        var shareDirectory = badgeFileSettings.Value.ShareDirectory;
        if (string.IsNullOrWhiteSpace(shareDirectory))
        {
            return StatusCode(500, "BadgeFileSettings:ShareDirectory is not configured.");
        }

        var resolvedFileName = BadgeFileNameResolver.ResolveFileName(fileName, attendanceDate);
        var targetDate = BadgeFileNameResolver.ResolveAttendanceDate(resolvedFileName, attendanceDate);

        var filePath = Path.Combine(shareDirectory, resolvedFileName);
        if (!System.IO.File.Exists(filePath))
        {
            return NotFound($"Badge file was not found: {filePath}");
        }

        var badgeSwipes = await badgeFileReaderService.ParseBadgeSwipePathAsync(filePath, cancellationToken);
        var updatedCount = await badgeAttendanceService.CrossCheckAsync(badgeSwipes, targetDate, cancellationToken);

        return Ok(new
        {
            attendanceDate = targetDate,
            fileName = resolvedFileName,
            filePath,
            swipeCount = badgeSwipes.Count,
            updatedCount
        });
    }

    [HttpPost("{date:datetime}/reset")]
    public async Task<IActionResult> ResetAndRegenerateAttendance(DateTime date, CancellationToken cancellationToken)
    {
        var targetDate = date.Date;

        var existingRecords = await dbContext.DailyAttendances
            .Where(x => x.Date == targetDate)
            .ToListAsync(cancellationToken);

        if (existingRecords.Count > 0)
        {
            dbContext.DailyAttendances.RemoveRange(existingRecords);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var newRecords = await CreateDefaultAttendancesAsync(targetDate, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var employeeIds = newRecords.Select(r => r.EmployeeId).Distinct().ToList();
        var employeeNames = await ResolveEmployeeNamesAsync(employeeIds, cancellationToken);
        var badgeFlags = await ResolveBadgeRequirementsAsync(employeeIds, cancellationToken);

        var result = newRecords.Select(r => new
        {
            r.Id,
            r.EmployeeId,
            EmployeeName = employeeNames.GetValueOrDefault(r.EmployeeId, "Unknown"),
            r.Date,
            r.IsPresent,
            r.Remark,
            RequiresBadgeSwipe = badgeFlags.GetValueOrDefault(r.EmployeeId, true)
        })
        .OrderBy(r => r.EmployeeId)
        .ToList();

        return Ok(new { message = "Attendance records reset and regenerated.", count = result.Count, records = result });
    }

    private async Task<bool> IsWorkingDayAsync(DateTime date, CancellationToken ct)
    {
        var targetDate = date.Date;
        var ov = await dbContext.WorkingDays
            .FirstOrDefaultAsync(w => w.Date == targetDate, ct);
        return ov?.IsWorkingDay ?? targetDate.DayOfWeek != DayOfWeek.Sunday;
    }

    /// <summary>
    /// Resolve badge requirements for employees.
    /// Returns: true = Regular Employee (must tap badge), false = Manager (no badge needed)
    /// </summary>
    private async Task<Dictionary<string, bool>> ResolveBadgeRequirementsAsync(
        List<string> employeeIds,
        CancellationToken cancellationToken)
    {
        var employees = await dbContext.Employees
            .AsNoTracking()
            .Where(e => e.EId != null && employeeIds.Contains(e.EId))
            .Select(e => new { e.EId, e.RequiresBadgeSwipe })
            .ToListAsync(cancellationToken);

        return employees.ToDictionary(e => e.EId!, e => e.RequiresBadgeSwipe);
    }

    private async Task<Dictionary<string, string>> ResolveEmployeeNamesAsync(
        List<string> employeeIds,
        CancellationToken cancellationToken)
    {
        var employees = await dbContext.Employees
            .AsNoTracking()
            .Where(e => e.EId != null && employeeIds.Contains(e.EId))
            .Select(e => new { e.EId, e.Name })
            .ToListAsync(cancellationToken);

        return employees.ToDictionary(e => e.EId!, e => e.Name);
    }

    /// <summary>
    /// Create default attendance records for a date.
    /// ALL employees get IsPresent = true:
    /// - Managers: IsPresent=true is locked (cannot be changed)
    /// - Regular Employees: IsPresent=true can be toggled by admin
    /// </summary>
    private async Task<List<DailyAttendance>> CreateDefaultAttendancesAsync(
        DateTime targetDate,
        CancellationToken cancellationToken)
    {
        var employeeIds = await dbContext.Employees
            .AsNoTracking()
            .Where(e => e.EId != null && e.EId.Trim() != string.Empty)
            .Select(e => e.EId!.Trim())
            .Distinct()
            .ToListAsync(cancellationToken);

        var attendances = employeeIds.Select(employeeId => new DailyAttendance
        {
            EmployeeId = employeeId,
            Date = targetDate,
            IsPresent = true,
            Remark = null,
            IsBadgeCrossChecked = false
        }).ToList();

        dbContext.DailyAttendances.AddRange(attendances);
        return attendances;
    }
}
