namespace SafetyCount.Api.DTOs;

public class MorningAttendanceSubmitDto
{
    public int EmployeeId { get; set; }

    public bool IsPresent { get; set; }

    public string? Remark { get; set; }
}
