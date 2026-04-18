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
    /// auto-generates records for employees that require badge swipe.
    /// </summary>
    [HttpGet("{date:datetime}")]
    public async Task<IActionResult> GetAttendanceByDate(DateTime date, CancellationToken cancellationToken)
    {
        var targetDate = date.Date;

        var records = await dbContext.DailyAttendances
            .Where(x => x.Date == targetDate)
            .ToListAsync(cancellationToken);

        // Auto-generate if no records exist for this date
        if (records.Count == 0)
        {
            var employees = await dbContext.Employees
                .ToListAsync(cancellationToken);

            foreach (var emp in employees)
            {
                if (string.IsNullOrWhiteSpace(emp.EId))
                {
                    continue;
                }

                var attendance = new DailyAttendance
                {
                    EmployeeId = emp.EId,
                    Date = targetDate,
                    IsPresent = true,
                    Remark = null,
                    IsBadgeCrossChecked = false
                };
                dbContext.DailyAttendances.Add(attendance);
                records.Add(attendance);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        // Load employee names
        var employeeIds = records.Select(r => r.EmployeeId).Distinct().ToList();
        var employeeNames = await ResolveEmployeeNamesAsync(employeeIds, cancellationToken);

        var result = records.Select(r => new
        {
            r.Id,
            r.EmployeeId,
            EmployeeName = employeeNames.GetValueOrDefault(r.EmployeeId, "Unknown"),
            r.Date,
            r.IsPresent,
            r.Remark
        })
        .OrderBy(r => r.EmployeeId)
        .ToList();

        return Ok(result);
    }

    /// <summary>
    /// Update attendance for a single employee on a specific date.
    /// </summary>
    [HttpPut("{date:datetime}/{employeeId}")]
    public async Task<IActionResult> UpdateAttendance(
        DateTime date,
        string employeeId,
        [FromBody] MorningAttendanceSubmitDto dto,
        CancellationToken cancellationToken)
    {
        var targetDate = date.Date;

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
        var updatedCount = await badgeAttendanceService.CrossCheckTodayAsync(badgeSwipes, cancellationToken);

        return Ok(new { swipeCount = badgeSwipes.Count, updatedCount });
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

        var targetDate = (attendanceDate ?? DateTime.Today).Date;
        var resolvedFileName = string.IsNullOrWhiteSpace(fileName)
            ? $"{targetDate.ToString("ddMMMyy", CultureInfo.InvariantCulture).ToUpperInvariant()}.TAF"
            : Path.GetFileName(fileName.Trim());

        var filePath = Path.Combine(shareDirectory, resolvedFileName);
        if (!System.IO.File.Exists(filePath))
        {
            return NotFound($"Badge file was not found: {filePath}");
        }

        var badgeSwipes = await badgeFileReaderService.ParseBadgeSwipePathAsync(filePath, cancellationToken);
        var updatedCount = await badgeAttendanceService.CrossCheckTodayAsync(badgeSwipes, cancellationToken);

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

        var employees = await dbContext.Employees
            .ToListAsync(cancellationToken);

        var newRecords = new List<DailyAttendance>();

        foreach (var emp in employees)
        {
            if (string.IsNullOrWhiteSpace(emp.EId))
            {
                continue;
            }

            var attendance = new DailyAttendance
            {
                EmployeeId = emp.EId,
                Date = targetDate,
                IsPresent = true,
                Remark = null,
                IsBadgeCrossChecked = false
            };
            dbContext.DailyAttendances.Add(attendance);
            newRecords.Add(attendance);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var employeeIds = newRecords.Select(r => r.EmployeeId).Distinct().ToList();
        var employeeNames = await ResolveEmployeeNamesAsync(employeeIds, cancellationToken);

        var result = newRecords.Select(r => new
        {
            r.Id,
            r.EmployeeId,
            EmployeeName = employeeNames.GetValueOrDefault(r.EmployeeId, "Unknown"),
            r.Date,
            r.IsPresent,
            r.Remark
        })
        .OrderBy(r => r.EmployeeId)
        .ToList();

        return Ok(new { message = "Attendance records reset and regenerated.", count = result.Count, records = result });
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
}
