using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SafetyCount.Api.Models;

public class DailyAttendance
{
    public int Id { get; set; }

    [ForeignKey(nameof(Employee))]
    public int EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public DateTime Date { get; set; }

    public bool IsPresent { get; set; }

    [MaxLength(255)]
    public string? Remark { get; set; }

    public DateTime? BadgeSwipeTime { get; set; }

    public bool IsBadgeCrossChecked { get; set; } = false;
}
