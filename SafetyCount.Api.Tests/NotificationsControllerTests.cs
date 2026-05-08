using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SafetyCount.Api.Controllers;
using SafetyCount.Api.DTOs;
using SafetyCount.Api.Data;
using SafetyCount.Api.Models;
using SafetyCount.Api.Options;
using SafetyCount.Api.Services;

namespace SafetyCount.Api.Tests;

public class NotificationsControllerTests
{
    [Fact]
    public async Task CrossCheckShareAndSendEmail_ShouldUseDateFromFileName()
    {
        var targetDate = DateTime.Today.AddDays(-4).Date;
        var shareDirectory = Path.Combine(Path.GetTempPath(), $"badge-share-{Guid.NewGuid():N}");
        Directory.CreateDirectory(shareDirectory);

        var fileName = $"{targetDate:ddMMMyy}".ToUpperInvariant() + ".TAF";
        var filePath = Path.Combine(shareDirectory, fileName);
        await File.WriteAllTextAsync(filePath, $"4804120I {targetDate:yyMMdd} 0546 05{Environment.NewLine}");

        try
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;

            await using var dbContext = new ApplicationDbContext(options);
            dbContext.Employees.Add(new Employee { EId = "480412", Name = "Alice" });
            await dbContext.SaveChangesAsync();

            var emailSender = new RecordingEmailSenderService();
            var controller = new NotificationsController(
                dbContext,
                emailSender,
                new BadgeFileReaderService(),
                new BadgeAttendanceService(dbContext),
                Microsoft.Extensions.Options.Options.Create(new BadgeFileSettings { ShareDirectory = shareDirectory }));

            var dto = new CrossCheckShareAndEmailRequestDto
            {
                AttendanceDate = DateTime.Today,
                FileName = fileName,
                To = "manager@company.com",
                Subject = "Daily Attendance Report",
                IncludeAttendanceTable = true
            };

            var actionResult = await controller.CrossCheckShareAndSendEmail(dto, CancellationToken.None);

            var okResult = Assert.IsType<OkObjectResult>(actionResult);
            Assert.NotNull(okResult.Value);

            var targetAttendance = await dbContext.DailyAttendances.SingleAsync(x => x.EmployeeId == "480412" && x.Date == targetDate);

            Assert.True(targetAttendance.IsPresent);
            Assert.True(targetAttendance.IsBadgeCrossChecked);
            Assert.Equal(targetDate, emailSender.LastRequest?.AttendanceDate);
            Assert.False(await dbContext.DailyAttendances.AnyAsync(x => x.EmployeeId == "480412" && x.Date == DateTime.Today));
        }
        finally
        {
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }

            if (Directory.Exists(shareDirectory))
            {
                Directory.Delete(shareDirectory);
            }
        }
    }

    private sealed class RecordingEmailSenderService : IEmailSenderService
    {
        public EmailNotificationRequestDto? LastRequest { get; private set; }

        public Task SendAsync(EmailNotificationRequestDto request, CancellationToken cancellationToken = default)
        {
            LastRequest = request;
            return Task.CompletedTask;
        }
    }
}