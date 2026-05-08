using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Data;
using SafetyCount.Api.DTOs;

namespace SafetyCount.Api.Services;

public class BadgeAttendanceService(ApplicationDbContext dbContext) : IBadgeAttendanceService
{
    public async Task<int> CrossCheckAsync(IEnumerable<BadgeSwipeDto> badgeSwipes, DateTime targetDate, CancellationToken cancellationToken = default)
    {
        var normalizedTargetDate = targetDate.Date;

        var employeeProfiles = await dbContext.Employees
            .AsNoTracking()
            .Where(x => x.EId != null && x.EId.Trim() != string.Empty)
            .Select(x => new
            {
                EmployeeId = x.EId!.Trim(),
                x.RequiresBadgeSwipe
            })
            .ToListAsync(cancellationToken);

        var employeeSettings = employeeProfiles
            .GroupBy(x => x.EmployeeId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.First().RequiresBadgeSwipe,
                StringComparer.OrdinalIgnoreCase);

        var employeeIds = employeeSettings
            .Where(x => x.Value)
            .Select(x => x.Key)
            .ToList();

        var targetAttendances = await dbContext.DailyAttendances
            .Where(x => x.Date == normalizedTargetDate)
            .ToDictionaryAsync(x => x.EmployeeId, cancellationToken);

        // Ensure attendance rows exist for all employees for the target date.
        foreach (var employeeId in employeeIds)
        {
            if (targetAttendances.ContainsKey(employeeId))
            {
                continue;
            }

            var attendance = new Models.DailyAttendance
            {
                EmployeeId = employeeId,
                Date = normalizedTargetDate,
                IsPresent = false,
                Remark = null,
                BadgeSwipeTime = null,
                IsBadgeCrossChecked = false
            };

            dbContext.DailyAttendances.Add(attendance);
            targetAttendances[employeeId] = attendance;
        }

        var firstInByEmployeeId = badgeSwipes
            .GroupBy(x => x.EmployeeId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderBy(x => x.SwipeTime).First().SwipeTime,
                StringComparer.OrdinalIgnoreCase);

        var updatedCount = 0;

        foreach (var employeeId in employeeIds)
        {
            if (!targetAttendances.TryGetValue(employeeId, out var attendance))
            {
                continue;
            }

            var hasIn = firstInByEmployeeId.TryGetValue(employeeId, out var firstInTime);
            attendance.IsPresent = hasIn;
            attendance.BadgeSwipeTime = hasIn ? firstInTime : null;
            attendance.IsBadgeCrossChecked = true;
            updatedCount++;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return updatedCount;
    }
}