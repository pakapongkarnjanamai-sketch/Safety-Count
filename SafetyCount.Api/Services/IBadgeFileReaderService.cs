using SafetyCount.Api.DTOs;

namespace SafetyCount.Api.Services;

public interface IBadgeFileReaderService
{
    Task<List<BadgeSwipeDto>> ParseBadgeSwipeFileAsync(IFormFile file, CancellationToken cancellationToken = default);
    
    Task<List<BadgeSwipeDto>> ParseBadgeSwipePathAsync(string filePath, CancellationToken cancellationToken = default);
}
