using Microsoft.AspNetCore.Mvc;

namespace SafetyCount.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmployeesController(IHttpClientFactory httpClientFactory) : ControllerBase
{
    private const string EmployeeServicePath =
        "ITM/Employee.Service/api/Employee/GetAllThai";

    [HttpGet]
    public async Task<IActionResult> GetEmployees(
        [FromQuery] string department,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 40,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(department))
        {
            return BadRequest("department is required.");
        }

        var sort = """[{"selector":"EId","desc":false}]""";
        var filter = $"""["Department","=","{department}"]""";
        var query = $"skip={skip}&take={take}&sort={Uri.EscapeDataString(sort)}&filter={Uri.EscapeDataString(filter)}";

        var client = httpClientFactory.CreateClient("EmployeeService");

        var response = await client.GetAsync($"{EmployeeServicePath}?{query}", cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, "Unable to retrieve employee data.");
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        return Content(content, "application/json");
    }
}
