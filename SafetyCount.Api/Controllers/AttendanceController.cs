using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Data;
using SafetyCount.Api.DTOs;
using SafetyCount.Api.Models;
using SafetyCount.Api.Services;
using System.Text.Json;

namespace SafetyCount.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttendanceController(
    ApplicationDbContext dbContext,
    IBadgeFileReaderService badgeFileReaderService,
    IHttpClientFactory httpClientFactory) : ControllerBase
{
    private const string EmployeeServicePath =
        "ITM/Employee.Service/api/Employee/GetAllThai";

    /// <summary>
    /// Get attendance for a specific date. If no records exist for that date,
    /// auto-generates records for all employees with IsPresent = true.
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
            var employees = await dbContext.Employees.ToListAsync(cancellationToken);

            foreach (var emp in employees)
            {
                var attendance = new DailyAttendance
                {
                    EmployeeId = emp.Id,
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
    [HttpPut("{date:datetime}/{employeeId:int}")]
    public async Task<IActionResult> UpdateAttendance(
        DateTime date,
        int employeeId,
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
        var today = DateTime.Today;

        var todayAttendances = await dbContext.DailyAttendances
            .Where(x => x.Date == today)
            .ToDictionaryAsync(x => x.EmployeeId, cancellationToken);

        foreach (var swipe in badgeSwipes
                     .GroupBy(x => x.EmployeeId)
                     .Select(group => group.OrderBy(x => x.SwipeTime).First()))
        {
            if (!todayAttendances.TryGetValue(swipe.EmployeeId, out var attendance))
            {
                continue;
            }

            attendance.BadgeSwipeTime = swipe.SwipeTime;
            attendance.IsBadgeCrossChecked = true;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    private async Task<Dictionary<int, string>> ResolveEmployeeNamesAsync(
        List<int> employeeIds,
        CancellationToken cancellationToken)
    {
        var names = await dbContext.Employees
            .Where(e => employeeIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => e.Name, cancellationToken);

        var unresolvedIds = employeeIds
            .Where(id => !names.ContainsKey(id))
            .ToList();

        if (unresolvedIds.Count == 0)
        {
            return names;
        }

        var externalNames = await LoadExternalEmployeeNamesAsync(cancellationToken);
        foreach (var employeeId in unresolvedIds)
        {
            if (externalNames.TryGetValue(employeeId.ToString(), out var name))
            {
                names[employeeId] = name;
            }
        }

        return names;
    }

    private async Task<Dictionary<string, string>> LoadExternalEmployeeNamesAsync(CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient("EmployeeService");
        var sort = """[{"selector":"EId","desc":false}]""";
        var filter = """["Department","=","SA"]""";
        var query = $"skip=0&take=500&sort={Uri.EscapeDataString(sort)}&filter={Uri.EscapeDataString(filter)}";

        try
        {
            using var response = await client.GetAsync($"{EmployeeServicePath}?{query}", cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var payload = await JsonSerializer.DeserializeAsync<ExternalEmployeeResponse>(
                stream,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
                cancellationToken);

            return payload?.Data?
                .Where(x => !string.IsNullOrWhiteSpace(x.EId))
                .Select(x => new
                {
                    x.EId,
                    Name = $"{x.ThaiPrefix ?? string.Empty}{x.ThaiFirstName ?? string.Empty} {x.ThaiLastName ?? string.Empty}".Trim()
                })
                .Where(x => !string.IsNullOrWhiteSpace(x.Name))
                .GroupBy(x => x.EId!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First().Name, StringComparer.OrdinalIgnoreCase)
                ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private sealed class ExternalEmployeeResponse
    {
        public List<ExternalEmployee>? Data { get; set; }
    }

    private sealed class ExternalEmployee
    {
        public string? EId { get; set; }

        public string? ThaiPrefix { get; set; }

        public string? ThaiFirstName { get; set; }

        public string? ThaiLastName { get; set; }
    }
}
