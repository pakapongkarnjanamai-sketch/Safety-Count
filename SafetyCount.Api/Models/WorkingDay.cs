namespace SafetyCount.Api.Models;

public class WorkingDay
{
    public int Id { get; set; }

    /// <summary>The date (time portion is always midnight UTC).</summary>
    public DateTime Date { get; set; }

    public bool IsWorkingDay { get; set; }
}
