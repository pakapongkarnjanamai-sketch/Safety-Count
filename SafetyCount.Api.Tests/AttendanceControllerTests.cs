using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Controllers;
using SafetyCount.Api.Data;
using SafetyCount.Api.Models;
using SafetyCount.Api.Services;

namespace SafetyCount.Api.Tests;

public class AttendanceControllerTests
{
    [Fact]
    public async Task CrossCheckBadges_ShouldUpdateTodayAttendance_WhenEmployeeIdMatches()
    {
        var today = DateTime.Today;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new ApplicationDbContext(options);
        dbContext.DailyAttendances.AddRange(
            new DailyAttendance { EmployeeId = 4804120, Date = today, IsPresent = true },
            new DailyAttendance { EmployeeId = 4804999, Date = today, IsPresent = true });
        await dbContext.SaveChangesAsync();

        var badgeReaderService = new BadgeFileReaderService();
        var controller = new AttendanceController(dbContext, badgeReaderService);

        var content = $"4804120I {today:yyMMdd} 0546 05\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(content));
        IFormFile file = new FormFile(stream, 0, stream.Length, "file", "badge.taf");

        var actionResult = await controller.CrossCheckBadges(file, CancellationToken.None);

        Assert.IsType<OkResult>(actionResult);

        var updatedAttendance = await dbContext.DailyAttendances.SingleAsync(x => x.EmployeeId == 4804120);
        var untouchedAttendance = await dbContext.DailyAttendances.SingleAsync(x => x.EmployeeId == 4804999);

        Assert.True(updatedAttendance.IsBadgeCrossChecked);
        Assert.Equal(today.AddHours(5).AddMinutes(46), updatedAttendance.BadgeSwipeTime);
        Assert.False(untouchedAttendance.IsBadgeCrossChecked);
        Assert.Null(untouchedAttendance.BadgeSwipeTime);
    }
}
