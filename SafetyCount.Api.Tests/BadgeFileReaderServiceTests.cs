using System.Text;
using Microsoft.AspNetCore.Http;
using SafetyCount.Api.Services;

namespace SafetyCount.Api.Tests;

public class BadgeFileReaderServiceTests
{
    [Fact]
    public async Task ParseBadgeSwipeFileAsync_ShouldReadOnlyInRecordsWithValidFormat()
    {
        var todayToken = DateTime.Today.ToString("yyMMdd");
        var content = $"4804120I {todayToken} 0546 05\n4804120O {todayToken} 1730 05\ninvalid\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(content));
        IFormFile file = new FormFile(stream, 0, stream.Length, "file", "badge.taf");

        var service = new BadgeFileReaderService();

        var result = await service.ParseBadgeSwipeFileAsync(file);

        Assert.Single(result);
        Assert.Equal(4804120, result[0].EmployeeId);
        Assert.Equal(DateTime.Today.AddHours(5).AddMinutes(46), result[0].SwipeTime);
    }
}
