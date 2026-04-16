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

    /// <summary>
    /// Get employees from external API by department.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetEmployees(
        [FromQuery] string department = "SA",
        [FromQuery] int skip = 0,
        [FromQuery] int take = 40,
        CancellationToken cancellationToken = default)
    {
        var sort = """[{"selector":"EId","desc":false}]""";
        var filter = $"""["Department","=","{department}"]""";
        var query = $"skip={skip}&take={take}&sort={Uri.EscapeDataString(sort)}&filter={Uri.EscapeDataString(filter)}";

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

        // Ensure default department exists
        var defaultDepartment = await dbContext.Departments.FirstOrDefaultAsync(d => d.Name == "Default", cancellationToken);
        if (defaultDepartment is null)
        {
            defaultDepartment = new Department { Name = "Default" };
            dbContext.Departments.Add(defaultDepartment);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var employee = new Employee
        {
            Name = dto.Name.Trim(),
            DepartmentId = defaultDepartment.Id
        };

        dbContext.Employees.Add(employee);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { employee.Id, employee.Name });
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
        [FromQuery] string department = "SA",
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100,
        CancellationToken cancellationToken = default)
    {
        var sort = """[{"selector":"EId","desc":false}]""";
        var filter = $"""["Department","=","{department}"]""";
        var query = $"skip={skip}&take={take}&sort={Uri.EscapeDataString(sort)}&filter={Uri.EscapeDataString(filter)}";

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

        if (payload?.Data is null)
        {
            return Ok(Array.Empty<object>());
        }

        var existingNames = await dbContext.Employees
            .Select(x => x.Name)
            .ToHashSetAsync(cancellationToken);

        var result = payload.Data
            .Select(ext =>
            {
                var name = $"{ext.ThaiPrefix ?? ""}{ext.ThaiFirstName ?? ""} {ext.ThaiLastName ?? ""}".Trim();
                return new
                {
                    eId = ext.EId,
                    name,
                    department = ext.Department,
                    alreadyAdded = existingNames.Contains(name)
                };
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.name))
            .ToList();

        return Ok(result);
    }

    /// <summary>
    /// Sync employees from external API into local database.
    /// Merges by matching on EId — new employees are added, existing ones are skipped.
    /// </summary>
    [HttpPost("sync")]
    public async Task<IActionResult> SyncFromExternalApi(
        [FromQuery] string department = "SA",
        [FromQuery] int take = 100,
        CancellationToken cancellationToken = default)
    {
        var sort = """[{"selector":"EId","desc":false}]""";
        var filter = $"""["Department","=","{department}"]""";
        var query = $"skip=0&take={take}&sort={Uri.EscapeDataString(sort)}&filter={Uri.EscapeDataString(filter)}";

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

        // Ensure default department exists
        var defaultDepartment = await dbContext.Departments.FirstOrDefaultAsync(d => d.Name == "Default", cancellationToken);
        if (defaultDepartment is null)
        {
            defaultDepartment = new Department { Name = "Default" };
            dbContext.Departments.Add(defaultDepartment);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var existingNames = await dbContext.Employees
            .Select(x => x.Name)
            .ToHashSetAsync(cancellationToken);

        var added = 0;
        foreach (var ext in payload.Data)
        {
            var name = $"{ext.ThaiPrefix ?? ""}{ext.ThaiFirstName ?? ""} {ext.ThaiLastName ?? ""}".Trim();
            if (string.IsNullOrWhiteSpace(name) || existingNames.Contains(name))
            {
                continue;
            }

            dbContext.Employees.Add(new Employee
            {
                Name = name,
                DepartmentId = defaultDepartment.Id
            });
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
