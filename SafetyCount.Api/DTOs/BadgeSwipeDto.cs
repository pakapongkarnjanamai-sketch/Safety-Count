namespace SafetyCount.Api.DTOs;

public class BadgeSwipeDto
{
    public string EmployeeId { get; set; } = string.Empty;

    public DateTime SwipeTime { get; set; }
}
