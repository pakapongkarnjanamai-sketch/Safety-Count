using System.ComponentModel.DataAnnotations;

namespace SafetyCount.Api.DTOs;

public class CrossCheckShareAndEmailRequestDto
{
    public DateTime? AttendanceDate { get; set; }

    public string? FileName { get; set; }

    [EmailAddress]
    public string? To { get; set; }

    public List<string> Recipients { get; set; } = [];

    [Required]
    [MaxLength(200)]
    public string Subject { get; set; } = string.Empty;

    public bool IncludeAttendanceTable { get; set; } = true;

    public string Body { get; set; } = string.Empty;

    public bool IsBodyHtml { get; set; }
}