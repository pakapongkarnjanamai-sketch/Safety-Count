using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Data;
using SafetyCount.Api.DTOs;
using SafetyCount.Api.Models;

namespace SafetyCount.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EvacuationController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpPost("checkin")]
    public async Task<IActionResult> CheckIn([FromBody] EvacuationCheckInSubmitDto request, CancellationToken cancellationToken)
    {
        var employeeExists = await dbContext.Employees.AnyAsync(x => x.Id == request.EmployeeId, cancellationToken);
        if (!employeeExists)
        {
            return NotFound($"Employee {request.EmployeeId} was not found.");
        }

        dbContext.CheckIns.Add(new CheckIn
        {
            EmployeeId = request.EmployeeId,
            Status = request.Status
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpGet("report")]
    public async Task<IActionResult> GetReport(CancellationToken cancellationToken)
    {
        var latestCheckIns = await dbContext.CheckIns
            .GroupBy(x => x.EmployeeId)
            .Select(group => group.OrderByDescending(x => x.CheckInTime).First())
            .ToListAsync(cancellationToken);

        var latestStatusLookup = latestCheckIns.ToDictionary(x => x.EmployeeId, x => x.Status);

        var report = await dbContext.Departments
            .Select(department => new
            {
                DepartmentId = department.Id,
                DepartmentName = department.Name,
                TotalEmployees = department.Employees.Count,
                SafeCount = department.Employees.Count(employee =>
                    latestStatusLookup.ContainsKey(employee.Id) &&
                    latestStatusLookup[employee.Id].Equals("Safe", StringComparison.OrdinalIgnoreCase))
            })
            .ToListAsync(cancellationToken);

        return Ok(report);
    }
}
