using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SafetyCount.Api.Models;

public class CheckIn
{
    public int Id { get; set; }

    [ForeignKey(nameof(Employee))]
    public int EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public DateTime CheckInTime { get; set; } = DateTime.Now;

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Safe";
}
