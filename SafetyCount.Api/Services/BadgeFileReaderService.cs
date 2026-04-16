using System.Globalization;
using System.Text.RegularExpressions;
using SafetyCount.Api.DTOs;

namespace SafetyCount.Api.Services;

public class BadgeFileReaderService : IBadgeFileReaderService
{
    private static readonly Regex BadgeTokenRegex = new("^(?<eid>\\d{6})\\d(?<direction>[A-Za-z])$", RegexOptions.Compiled);

    public async Task<List<BadgeSwipeDto>> ParseBadgeSwipeFileAsync(IFormFile file, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(file);

        await using var stream = file.OpenReadStream();
        return await ParseBadgeSwipeStreamAsync(stream, cancellationToken);
    }

    public async Task<List<BadgeSwipeDto>> ParseBadgeSwipePathAsync(string filePath, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);

        await using var stream = File.OpenRead(filePath);
        return await ParseBadgeSwipeStreamAsync(stream, cancellationToken);
    }

    private static async Task<List<BadgeSwipeDto>> ParseBadgeSwipeStreamAsync(Stream stream, CancellationToken cancellationToken)
    {
        var badgeSwipes = new List<BadgeSwipeDto>();

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
            var tokenMatch = BadgeTokenRegex.Match(employeeToken);
            if (!tokenMatch.Success)
            {
                continue;
            }

            var direction = tokenMatch.Groups["direction"].Value;
            if (!string.Equals(direction, "I", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var employeeId = tokenMatch.Groups["eid"].Value;

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
