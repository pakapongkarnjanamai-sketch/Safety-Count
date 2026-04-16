using System.ComponentModel.DataAnnotations;

namespace SafetyCount.Api.DTOs;

public class EvacuationCheckInSubmitDto
{
    public int EmployeeId { get; set; }

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Safe";
}
