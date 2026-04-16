using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Data;
using SafetyCount.Api.DTOs;
using SafetyCount.Api.Models;
using SafetyCount.Api.Services;

namespace SafetyCount.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttendanceController(ApplicationDbContext dbContext, IBadgeFileReaderService badgeFileReaderService) : ControllerBase
{
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
}
