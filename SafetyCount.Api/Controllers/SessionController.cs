using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SafetyCount.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class SessionController : ControllerBase
{
    [HttpGet("me")]
    public IActionResult GetCurrentUser()
    {
        var windowsIdentity = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name ?? string.Empty;
        var nId = User.FindFirst("safetycount.nid")?.Value ?? NormalizeWindowsIdentity(windowsIdentity);
        var roles = User.FindAll(ClaimTypes.Role)
            .Select(c => c.Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x)
            .ToArray();

        return Ok(new
        {
            displayName = nId,
            windowsIdentity,
            isAuthenticated = User.Identity?.IsAuthenticated == true,
            nId,
            accessLevel = roles
        });
    }

    private static string NormalizeWindowsIdentity(string? windowsIdentity)
    {
        if (string.IsNullOrWhiteSpace(windowsIdentity))
        {
            return string.Empty;
        }

        var parts = windowsIdentity.Split('\\', StringSplitOptions.RemoveEmptyEntries);
        return (parts.Length > 0 ? parts[^1] : windowsIdentity).Trim().ToUpperInvariant();
    }
}
