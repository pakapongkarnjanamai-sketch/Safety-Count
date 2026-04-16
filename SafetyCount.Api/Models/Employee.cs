using System.ComponentModel.DataAnnotations;

namespace SafetyCount.Api.Models;

public class Employee
{
    public int Id { get; set; }

    [MaxLength(50)]
    public string? EId { get; set; }

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Department { get; set; }

    public bool RequiresBadgeSwipe { get; set; } = true;
}
