namespace SafetyCount.Api.DTOs;

public class MorningAttendanceSubmitDto
{
    public string EmployeeId { get; set; } = string.Empty;

    public bool IsPresent { get; set; }

    public string? Remark { get; set; }
}
