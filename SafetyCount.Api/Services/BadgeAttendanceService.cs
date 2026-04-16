using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Data;
using SafetyCount.Api.DTOs;

namespace SafetyCount.Api.Services;

public class BadgeAttendanceService(ApplicationDbContext dbContext) : IBadgeAttendanceService
{
    public async Task<int> CrossCheckTodayAsync(IEnumerable<BadgeSwipeDto> badgeSwipes, CancellationToken cancellationToken = default)
    {
        var today = DateTime.Today;

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

        var employeeIds = employeeSettings.Keys.ToList();

        var todayAttendances = await dbContext.DailyAttendances
            .Where(x => x.Date == DateTime.Today)
            .ToDictionaryAsync(x => x.EmployeeId, cancellationToken);

        // Ensure attendance rows exist for all employees for today.
        foreach (var employeeId in employeeIds)
        {
            if (todayAttendances.ContainsKey(employeeId))
            {
                continue;
            }

            var requiresBadgeSwipe = employeeSettings.GetValueOrDefault(employeeId, true);

            var attendance = new Models.DailyAttendance
            {
                EmployeeId = employeeId,
                Date = today,
                IsPresent = !requiresBadgeSwipe,
                Remark = null,
                BadgeSwipeTime = null,
                IsBadgeCrossChecked = false
            };

            dbContext.DailyAttendances.Add(attendance);
            todayAttendances[employeeId] = attendance;
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
            if (!todayAttendances.TryGetValue(employeeId, out var attendance))
            {
                continue;
            }

            var requiresBadgeSwipe = employeeSettings.GetValueOrDefault(employeeId, true);
            if (!requiresBadgeSwipe)
            {
                attendance.IsPresent = true;
                attendance.BadgeSwipeTime = null;
                attendance.IsBadgeCrossChecked = true;
                updatedCount++;
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