using System.ComponentModel.DataAnnotations;

namespace SafetyCount.Api.Models;

public class DailyAttendance
{
    public int Id { get; set; }

    public string EmployeeId { get; set; } = string.Empty;

    public DateTime Date { get; set; }

    public bool IsPresent { get; set; }

    [MaxLength(255)]
    public string? Remark { get; set; }

    public DateTime? BadgeSwipeTime { get; set; }

    public bool IsBadgeCrossChecked { get; set; } = false;
}
