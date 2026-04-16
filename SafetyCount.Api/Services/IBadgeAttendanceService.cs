using SafetyCount.Api.DTOs;

namespace SafetyCount.Api.Services;

public interface IBadgeAttendanceService
{
    Task<int> CrossCheckTodayAsync(IEnumerable<BadgeSwipeDto> badgeSwipes, CancellationToken cancellationToken = default);
}