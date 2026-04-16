using System.ComponentModel.DataAnnotations;

namespace SafetyCount.Api.DTOs;

public class EmailNotificationRequestDto
{
    [EmailAddress]
    public string? To { get; set; }

    public string? Sender { get; set; }

    public List<string> Recipients { get; set; } = [];

    public List<string>? Cc { get; set; }

    public List<string>? Bcc { get; set; }

    [Required]
    [MaxLength(200)]
    public string Subject { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public List<string> Attachments { get; set; } = [];

    public bool IsBodyHtml { get; set; }

    public bool IncludeAttendanceTable { get; set; }

    public DateTime? AttendanceDate { get; set; }
}