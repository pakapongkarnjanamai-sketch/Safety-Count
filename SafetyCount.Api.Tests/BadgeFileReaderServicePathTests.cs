using SafetyCount.Api.Services;

namespace SafetyCount.Api.Tests;

public class BadgeFileReaderServicePathTests
{
    [Fact]
    public async Task ParseBadgeSwipePathAsync_ShouldReadFileFromDisk()
    {
        var filePath = Path.Combine(Path.GetTempPath(), $"badge-{Guid.NewGuid():N}.taf");
        await File.WriteAllTextAsync(filePath, $"4804120I {DateTime.Today:yyMMdd} 0546 05{Environment.NewLine}");

        try
        {
            var service = new BadgeFileReaderService();

            var result = await service.ParseBadgeSwipePathAsync(filePath);

            Assert.Single(result);
            Assert.Equal("480412", result[0].EmployeeId);
        }
        finally
        {
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }
        }
    }
}