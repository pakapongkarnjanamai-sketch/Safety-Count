using System.Globalization;
using SafetyCount.Api.DTOs;

namespace SafetyCount.Api.Services;

public class BadgeFileReaderService : IBadgeFileReaderService
{
    public async Task<List<BadgeSwipeDto>> ParseBadgeSwipeFileAsync(IFormFile file, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(file);

        var badgeSwipes = new List<BadgeSwipeDto>();

        using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream);

        while (!reader.EndOfStream)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var line = await reader.ReadLineAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 3)
            {
                continue;
            }

            var employeeToken = parts[0].Trim();
            if (!employeeToken.EndsWith('I'))
            {
                continue;
            }

            if (!int.TryParse(employeeToken[..^1], out var employeeId))
            {
                continue;
            }

            if (!DateTime.TryParseExact(
                    $"{parts[1]} {parts[2]}",
                    "yyMMdd HHmm",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var swipeTime))
            {
                continue;
            }

            badgeSwipes.Add(new BadgeSwipeDto
            {
                EmployeeId = employeeId,
                SwipeTime = swipeTime
            });
        }

        return badgeSwipes;
    }
}
