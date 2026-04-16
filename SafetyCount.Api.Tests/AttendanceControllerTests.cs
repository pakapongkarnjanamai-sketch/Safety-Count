using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SafetyCount.Api.Controllers;
using SafetyCount.Api.Data;
using SafetyCount.Api.Models;
using SafetyCount.Api.Options;
using SafetyCount.Api.Services;

namespace SafetyCount.Api.Tests;

public class AttendanceControllerTests
{
    [Fact]
    public async Task CrossCheckBadges_ShouldSetPresentAndAbsentBasedOnInSwipes()
    {
        var today = DateTime.Today;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new ApplicationDbContext(options);
        dbContext.Employees.AddRange(
            new Employee { EId = "480412", Name = "Alice" },
            new Employee { EId = "480499", Name = "Bob" });
        dbContext.DailyAttendances.AddRange(
            new DailyAttendance { EmployeeId = "480412", Date = today, IsPresent = true },
            new DailyAttendance { EmployeeId = "480499", Date = today, IsPresent = true });
        await dbContext.SaveChangesAsync();

        var badgeReaderService = new BadgeFileReaderService();
        var badgeAttendanceService = new BadgeAttendanceService(dbContext);
        var controller = new AttendanceController(
            dbContext,
            badgeReaderService,
            badgeAttendanceService,
            Microsoft.Extensions.Options.Options.Create(new BadgeFileSettings()));

        var content = $"4804120I {today:yyMMdd} 0546 05\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(content));
        IFormFile file = new FormFile(stream, 0, stream.Length, "file", "badge.taf");

        var actionResult = await controller.CrossCheckBadges(file, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        Assert.NotNull(okResult.Value);

        var updatedAttendance = await dbContext.DailyAttendances.SingleAsync(x => x.EmployeeId == "480412");
        var untouchedAttendance = await dbContext.DailyAttendances.SingleAsync(x => x.EmployeeId == "480499");

        Assert.True(updatedAttendance.IsBadgeCrossChecked);
        Assert.True(updatedAttendance.IsPresent);
        Assert.Equal(today.AddHours(5).AddMinutes(46), updatedAttendance.BadgeSwipeTime);
        Assert.True(untouchedAttendance.IsBadgeCrossChecked);
        Assert.False(untouchedAttendance.IsPresent);
        Assert.Null(untouchedAttendance.BadgeSwipeTime);
    }

    [Fact]
    public async Task CrossCheckBadges_ShouldCreateMissingDailyAttendanceForToday()
    {
        var today = DateTime.Today;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new ApplicationDbContext(options);
        dbContext.Employees.AddRange(
            new Employee { EId = "480412", Name = "Alice" },
            new Employee { EId = "480499", Name = "Bob" });
        await dbContext.SaveChangesAsync();

        var badgeReaderService = new BadgeFileReaderService();
        var badgeAttendanceService = new BadgeAttendanceService(dbContext);
        var controller = new AttendanceController(
            dbContext,
            badgeReaderService,
            badgeAttendanceService,
            Microsoft.Extensions.Options.Options.Create(new BadgeFileSettings()));

        var content = $"4804120I {today:yyMMdd} 0546 05\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(content));
        IFormFile file = new FormFile(stream, 0, stream.Length, "file", "badge.taf");

        var actionResult = await controller.CrossCheckBadges(file, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        Assert.NotNull(okResult.Value);

        var allTodayAttendances = await dbContext.DailyAttendances
            .Where(x => x.Date == today)
            .ToListAsync();
        Assert.Equal(2, allTodayAttendances.Count);

        var presentAttendance = allTodayAttendances.Single(x => x.EmployeeId == "480412");
        var absentAttendance = allTodayAttendances.Single(x => x.EmployeeId == "480499");

        Assert.True(presentAttendance.IsPresent);
        Assert.True(presentAttendance.IsBadgeCrossChecked);
        Assert.Equal(today.AddHours(5).AddMinutes(46), presentAttendance.BadgeSwipeTime);

        Assert.False(absentAttendance.IsPresent);
        Assert.True(absentAttendance.IsBadgeCrossChecked);
        Assert.Null(absentAttendance.BadgeSwipeTime);
    }

    [Fact]
    public async Task CrossCheckBadges_ShouldKeepNoBadgeRequiredEmployeesPresentWithoutSwipe()
    {
        var today = DateTime.Today;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new ApplicationDbContext(options);
        dbContext.Employees.AddRange(
            new Employee { EId = "480412", Name = "Alice", RequiresBadgeSwipe = true },
            new Employee { EId = "480499", Name = "Bob", RequiresBadgeSwipe = false });
        await dbContext.SaveChangesAsync();

        var badgeReaderService = new BadgeFileReaderService();
        var badgeAttendanceService = new BadgeAttendanceService(dbContext);
        var controller = new AttendanceController(
            dbContext,
            badgeReaderService,
            badgeAttendanceService,
            Microsoft.Extensions.Options.Options.Create(new BadgeFileSettings()));

        var content = $"4804120I {today:yyMMdd} 0546 05\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(content));
        IFormFile file = new FormFile(stream, 0, stream.Length, "file", "badge.taf");

        var actionResult = await controller.CrossCheckBadges(file, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        Assert.NotNull(okResult.Value);

        var requiredBadgeAttendance = await dbContext.DailyAttendances.SingleAsync(x => x.EmployeeId == "480412");
        var noBadgeAttendance = await dbContext.DailyAttendances.SingleAsync(x => x.EmployeeId == "480499");

        Assert.True(requiredBadgeAttendance.IsPresent);
        Assert.True(requiredBadgeAttendance.IsBadgeCrossChecked);

        Assert.True(noBadgeAttendance.IsPresent);
        Assert.True(noBadgeAttendance.IsBadgeCrossChecked);
        Assert.Null(noBadgeAttendance.BadgeSwipeTime);
    }
}
