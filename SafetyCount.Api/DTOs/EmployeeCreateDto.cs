namespace SafetyCount.Api.DTOs;

public class EmployeeCreateDto
{
    public string? EId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Department { get; set; }

    public bool? RequiresBadgeSwipe { get; set; }
}
