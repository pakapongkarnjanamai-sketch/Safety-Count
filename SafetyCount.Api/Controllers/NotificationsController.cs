using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SafetyCount.Api.Data;
using SafetyCount.Api.DTOs;
using SafetyCount.Api.Options;
using SafetyCount.Api.Services;

namespace SafetyCount.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationsController(
    ApplicationDbContext dbContext,
    IEmailSenderService emailSenderService,
    IBadgeFileReaderService badgeFileReaderService,
    IBadgeAttendanceService badgeAttendanceService,
    IOptions<BadgeFileSettings> badgeFileSettings) : ControllerBase
{
    [HttpPost("email")]
    public async Task<IActionResult> SendEmail([FromBody] EmailNotificationRequestDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var recipients = dto.Recipients
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .ToList();

        if (!string.IsNullOrWhiteSpace(dto.To))
        {
            recipients.Add(dto.To.Trim());
        }

        recipients = recipients
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (recipients.Count == 0)
        {
            ModelState.AddModelError(nameof(dto.Recipients), "At least one recipient is required.");
            return ValidationProblem(ModelState);
        }

        dto.Recipients = recipients;

                if (dto.IncludeAttendanceTable)
                {
                        var targetDate = (dto.AttendanceDate ?? DateTime.Today).Date;
                        dto.Body = await BuildAttendanceTableHtmlAsync(targetDate, cancellationToken);
                        dto.IsBodyHtml = true;
                }

        try
        {
            await emailSenderService.SendAsync(dto, cancellationToken);
        }
        catch (HttpRequestException ex) when (ex.StatusCode.HasValue)
        {
            return StatusCode((int)ex.StatusCode.Value, new
            {
                message = "Unable to send email via mail service.",
                detail = ex.Message
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new
            {
                message = "Invalid email payload.",
                detail = ex.Message
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Unexpected error while sending email.",
                detail = ex.Message
            });
        }

        return Ok(new
        {
            message = "Email sent successfully.",
            recipients = dto.Recipients,
            subject = dto.Subject.Trim(),
            includeAttendanceTable = dto.IncludeAttendanceTable,
            attendanceDate = dto.IncludeAttendanceTable ? (dto.AttendanceDate ?? DateTime.Today).Date : (DateTime?)null
        });
    }

    [HttpPost("crosscheck-share-and-email")]
    public async Task<IActionResult> CrossCheckShareAndSendEmail([FromBody] CrossCheckShareAndEmailRequestDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var shareDirectory = badgeFileSettings.Value.ShareDirectory;
        if (string.IsNullOrWhiteSpace(shareDirectory))
        {
            return StatusCode(500, "BadgeFileSettings:ShareDirectory is not configured.");
        }

        var targetDate = (dto.AttendanceDate ?? DateTime.Today).Date;
        var resolvedFileName = string.IsNullOrWhiteSpace(dto.FileName)
            ? $"{targetDate:ddMMMyy}".ToUpperInvariant() + ".TAF"
            : Path.GetFileName(dto.FileName.Trim());

        var filePath = Path.Combine(shareDirectory, resolvedFileName);
        if (!System.IO.File.Exists(filePath))
        {
            return NotFound($"Badge file was not found: {filePath}");
        }

        var badgeSwipes = await badgeFileReaderService.ParseBadgeSwipePathAsync(filePath, cancellationToken);
        var updatedCount = await badgeAttendanceService.CrossCheckTodayAsync(badgeSwipes, cancellationToken);

        var recipients = dto.Recipients
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .ToList();

        if (!string.IsNullOrWhiteSpace(dto.To))
        {
            recipients.Add(dto.To.Trim());
        }

        recipients = recipients
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (recipients.Count == 0)
        {
            ModelState.AddModelError(nameof(dto.Recipients), "At least one recipient is required.");
            return ValidationProblem(ModelState);
        }

        var emailDto = new EmailNotificationRequestDto
        {
            To = dto.To,
            Recipients = recipients,
            Subject = dto.Subject,
            Body = dto.Body,
            IncludeAttendanceTable = dto.IncludeAttendanceTable,
            AttendanceDate = targetDate,
            IsBodyHtml = dto.IsBodyHtml
        };

        if (emailDto.IncludeAttendanceTable)
        {
            emailDto.Body = await BuildAttendanceTableHtmlAsync(targetDate, cancellationToken);
            emailDto.IsBodyHtml = true;
        }

        try
        {
            await emailSenderService.SendAsync(emailDto, cancellationToken);
        }
        catch (HttpRequestException ex) when (ex.StatusCode.HasValue)
        {
            return StatusCode((int)ex.StatusCode.Value, new
            {
                message = "Unable to send email via mail service.",
                detail = ex.Message
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new
            {
                message = "Invalid email payload.",
                detail = ex.Message
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Unexpected error while running combined flow.",
                detail = ex.Message
            });
        }

        return Ok(new
        {
            message = "Combined flow completed successfully.",
            crossCheck = new
            {
                attendanceDate = targetDate,
                fileName = resolvedFileName,
                filePath,
                swipeCount = badgeSwipes.Count,
                updatedCount
            },
            email = new
            {
                recipients,
                subject = emailDto.Subject.Trim(),
                includeAttendanceTable = emailDto.IncludeAttendanceTable,
                attendanceDate = emailDto.IncludeAttendanceTable ? targetDate : (DateTime?)null
            }
        });
    }

    private async Task<string> BuildAttendanceTableHtmlAsync(DateTime targetDate, CancellationToken cancellationToken)
    {
        var attendances = await dbContext.DailyAttendances
            .AsNoTracking()
            .Where(x => x.Date == targetDate)
            .ToDictionaryAsync(x => x.EmployeeId, cancellationToken);

        var employees = await dbContext.Employees
            .AsNoTracking()
            .OrderBy(x => x.EId)
            .ThenBy(x => x.Name)
            .Select(x => new { x.EId, x.Name, x.Department })
            .ToListAsync(cancellationToken);

        var totalCount = employees.Count;
        var presentCount = 0;
        var absentCount = 0;
        var rows = new List<string>(employees.Count);

        foreach (var employee in employees)
        {
            var employeeId = employee.EId ?? string.Empty;
            var status = "No Record";
            var isPresent = false;

            if (!string.IsNullOrWhiteSpace(employeeId) && attendances.TryGetValue(employeeId, out var matchedAttendance))
            {
                isPresent = matchedAttendance.IsPresent;
                status = isPresent ? "Present" : "Absent";
            }

            if (isPresent)
            {
                presentCount++;
            }
            else
            {
                absentCount++;
            }

            var rowStyle = isPresent ? "" : " style='background:#fff1f2'";
            rows.Add(
                $"<tr{rowStyle}>" +
                $"<td style='border:1px solid #ddd;padding:8px'>{WebUtility.HtmlEncode(employeeId)}</td>" +
                $"<td style='border:1px solid #ddd;padding:8px'>{WebUtility.HtmlEncode(employee.Name)}</td>" +
                $"<td style='border:1px solid #ddd;padding:8px'>{WebUtility.HtmlEncode(employee.Department ?? string.Empty)}</td>" +
                $"<td style='border:1px solid #ddd;padding:8px'>{status}</td>" +
                "</tr>");
        }

        return $"""
<div>
    <p>Attendance summary for {targetDate:yyyy-MM-dd}</p>
    <div style='margin:8px 0 14px 0;font-family:Arial,sans-serif;font-size:14px;color:#0f172a'>
        <strong>Total:</strong> {totalCount} |
        <strong> Present:</strong> {presentCount} |
        <strong> Absent:</strong> {absentCount}
    </div>
    <table style='border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px'>
        <thead>
            <tr style='background:#f3f4f6'>
                <th style='border:1px solid #ddd;padding:8px;text-align:left'>Employee ID</th>
                <th style='border:1px solid #ddd;padding:8px;text-align:left'>Name</th>
                <th style='border:1px solid #ddd;padding:8px;text-align:left'>Department</th>
                <th style='border:1px solid #ddd;padding:8px;text-align:left'>Status</th>
            </tr>
        </thead>
        <tbody>
            {string.Join(string.Empty, rows)}
        </tbody>
    </table>
</div>
""";
    }
}