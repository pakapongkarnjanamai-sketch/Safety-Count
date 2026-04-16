using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Data;
using SafetyCount.Api.DTOs;
using SafetyCount.Api.Models;

namespace SafetyCount.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmployeesController(ApplicationDbContext dbContext, IHttpClientFactory httpClientFactory) : ControllerBase
{
    private const string EmployeeServicePath =
        "ITM/Employee.Service/api/Employee/GetAllThai";

    private static string BuildExternalEmployeeQuery(int skip, int take, string? department)
    {
        var sort = """[{"selector":"EId","desc":false}]""";
        var queryParts = new List<string>
        {
            $"skip={skip}",
            $"take={take}",
            $"sort={Uri.EscapeDataString(sort)}"
        };

        if (!string.IsNullOrWhiteSpace(department))
        {
            var filter = $"""["Department","=","{department}"]""";
            queryParts.Add($"filter={Uri.EscapeDataString(filter)}");
        }

        return string.Join("&", queryParts);
    }

    /// <summary>
    /// Get employees from the local database table, optionally filtered by department.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetEmployees(
        [FromQuery] string? department,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 40,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Employees
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(department))
        {
            query = query.Where(e => e.Department == department);
        }

        var employees = await query
            .OrderBy(e => e.Id)
            .Skip(skip)
            .Take(take)
            .Select(e => new
            {
                e.Id,
                e.EId,
                e.Name,
                e.Department,
                e.RequiresBadgeSwipe
            })
            .ToListAsync(cancellationToken);

        return Ok(employees);
    }

    /// <summary>
    /// Get employees from the external API in raw format.
    /// </summary>
    [HttpGet("external/raw")]
    public async Task<IActionResult> GetExternalEmployeesRaw(
        [FromQuery] string? department,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 40,
        CancellationToken cancellationToken = default)
    {
        var query = BuildExternalEmployeeQuery(skip, take, department);

        var client = httpClientFactory.CreateClient("EmployeeService");

        HttpResponseMessage response;
        try
        {
            response = await client.GetAsync($"{EmployeeServicePath}?{query}", cancellationToken);
        }
        catch
        {
            return StatusCode(502, "Unable to reach external employee service.");
        }

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, "External employee service returned an error.");
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        return Content(content, "application/json");
    }

    /// <summary>
    /// Add a new employee to the local database.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateEmployee([FromBody] EmployeeCreateDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("Employee name is required.");
        }

        var trimmedEId = string.IsNullOrWhiteSpace(dto.EId) ? null : dto.EId.Trim();
        if (!string.IsNullOrWhiteSpace(trimmedEId))
        {
            var duplicateEId = await dbContext.Employees
                .AsNoTracking()
                .AnyAsync(e => e.EId == trimmedEId, cancellationToken);
            if (duplicateEId)
            {
                return Conflict($"Employee EId '{trimmedEId}' already exists.");
            }
        }

        var employee = new Employee
        {
            EId = trimmedEId,
            Name = dto.Name.Trim(),
            Department = string.IsNullOrWhiteSpace(dto.Department) ? null : dto.Department.Trim(),
            RequiresBadgeSwipe = dto.RequiresBadgeSwipe ?? true
        };

        dbContext.Employees.Add(employee);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { employee.Id, employee.EId, employee.Name, employee.Department, employee.RequiresBadgeSwipe });
    }

    [HttpPatch("{id:int}/badge-requirement")]
    public async Task<IActionResult> UpdateBadgeRequirement(
        int id,
        [FromBody] EmployeeBadgeRequirementUpdateDto dto,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FindAsync([id], cancellationToken);
        if (employee is null)
        {
            return NotFound($"Employee {id} was not found.");
        }

        employee.RequiresBadgeSwipe = dto.RequiresBadgeSwipe;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            employee.Id,
            employee.EId,
            employee.Name,
            employee.RequiresBadgeSwipe
        });
    }

    /// <summary>
    /// Delete an employee by ID.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteEmployee(int id, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FindAsync([id], cancellationToken);
        if (employee is null)
        {
            return NotFound($"Employee {id} was not found.");
        }

        dbContext.Employees.Remove(employee);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    /// <summary>
    /// Browse employees from the external API. Returns the list with an alreadyAdded flag.
    /// </summary>
    [HttpGet("external")]
    public async Task<IActionResult> GetExternalEmployees(
        [FromQuery] string? department,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        var safeTake = take <= 0 ? 50 : Math.Min(take, 500);
        var client = httpClientFactory.CreateClient("EmployeeService");
        var query = BuildExternalEmployeeQuery(skip, safeTake, department);

        HttpResponseMessage response;
        try
        {
            response = await client.GetAsync($"{EmployeeServicePath}?{query}", cancellationToken);
        }
        catch
        {
            return StatusCode(502, "Unable to reach external employee service.");
        }

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, "External employee service returned an error.");
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        var payload = System.Text.Json.JsonSerializer.Deserialize<ExternalEmployeeResponse>(content,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        var pageItems = payload?.Data ?? [];

        var existingEmployees = await dbContext.Employees
            .Select(x => new { x.EId, x.Name })
            .ToListAsync(cancellationToken);
        var existingEIds = existingEmployees
            .Where(x => !string.IsNullOrWhiteSpace(x.EId))
            .Select(x => x.EId!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var existingNames = existingEmployees
            .Select(x => x.Name)
            .ToHashSet();

        var result = pageItems
            .Select(ext =>
            {
                var name = $"{ext.ThaiPrefix ?? ""}{ext.ThaiFirstName ?? ""} {ext.ThaiLastName ?? ""}".Trim();
                return new
                {
                    eId = ext.EId,
                    name,
                    department = ext.Department,
                    alreadyAdded =
                        (!string.IsNullOrWhiteSpace(ext.EId) && existingEIds.Contains(ext.EId)) ||
                        existingNames.Contains(name)
                };
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.name))
            .ToList();

        var totalCount = payload?.TotalCount ?? -1;
        var hasMore = totalCount >= 0
            ? skip + result.Count < totalCount
            : result.Count == safeTake;

        return Ok(new
        {
            data = result,
            totalCount,
            skip,
            take = safeTake,
            hasMore
        });
    }

    /// <summary>
    /// Sync employees from external API into local database.
    /// Merges by matching on EId — new employees are added, existing ones are skipped.
    /// </summary>
    [HttpPost("sync")]
    public async Task<IActionResult> SyncFromExternalApi(
        [FromQuery] string? department,
        [FromQuery] int take = 100,
        CancellationToken cancellationToken = default)
    {
        var query = BuildExternalEmployeeQuery(0, take, department);

        var client = httpClientFactory.CreateClient("EmployeeService");

        HttpResponseMessage response;
        try
        {
            response = await client.GetAsync($"{EmployeeServicePath}?{query}", cancellationToken);
        }
        catch
        {
            return StatusCode(502, "Unable to reach external employee service.");
        }

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, "External employee service returned an error.");
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        var payload = System.Text.Json.JsonSerializer.Deserialize<ExternalEmployeeResponse>(content,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (payload?.Data is null || payload.Data.Count == 0)
        {
            return Ok(new { added = 0, message = "No employees found from external API." });
        }

        var existingEmployees = await dbContext.Employees
            .Select(x => new { x.EId, x.Name })
            .ToListAsync(cancellationToken);
        var existingEIds = existingEmployees
            .Where(x => !string.IsNullOrWhiteSpace(x.EId))
            .Select(x => x.EId!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var existingNames = existingEmployees
            .Select(x => x.Name)
            .ToHashSet();

        var added = 0;
        foreach (var ext in payload.Data)
        {
            var name = $"{ext.ThaiPrefix ?? ""}{ext.ThaiFirstName ?? ""} {ext.ThaiLastName ?? ""}".Trim();
            var eId = string.IsNullOrWhiteSpace(ext.EId) ? null : ext.EId.Trim();
            if (
                string.IsNullOrWhiteSpace(name) ||
                (!string.IsNullOrWhiteSpace(eId) && existingEIds.Contains(eId)) ||
                existingNames.Contains(name)
            )
            {
                continue;
            }

            dbContext.Employees.Add(new Employee
            {
                EId = eId,
                Name = name,
                Department = string.IsNullOrWhiteSpace(ext.Department) ? null : ext.Department.Trim(),
                RequiresBadgeSwipe = true
            });
            if (!string.IsNullOrWhiteSpace(eId))
            {
                existingEIds.Add(eId);
            }
            existingNames.Add(name);
            added++;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { added, message = $"Synced {added} new employee(s) from external API." });
    }

    // Internal model for deserializing external API response
    private class ExternalEmployeeResponse
    {
        public List<ExternalEmployee>? Data { get; set; }

        public int? TotalCount { get; set; }
    }

    private class ExternalEmployee
    {
        public string? EId { get; set; }
        public string? ThaiPrefix { get; set; }
        public string? ThaiFirstName { get; set; }
        public string? ThaiLastName { get; set; }
        public string? Department { get; set; }
    }
}
