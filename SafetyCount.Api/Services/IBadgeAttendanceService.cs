using SafetyCount.Api.DTOs;

namespace SafetyCount.Api.Services;

public interface IBadgeAttendanceService
{
    Task<int> CrossCheckAsync(IEnumerable<BadgeSwipeDto> badgeSwipes, DateTime targetDate, CancellationToken cancellationToken = default);
}