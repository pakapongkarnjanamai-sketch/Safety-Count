using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

namespace SafetyCount.Api.Services;

public sealed class WindowsClaimsTransformation : IClaimsTransformation
{
    private const string LoadedClaimType = "safetycount.auth.loaded";
    private const string NidClaimType = "safetycount.nid";

    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true || principal.HasClaim(c => c.Type == LoadedClaimType))
        {
            return Task.FromResult(principal);
        }

        var nId = ExtractNId(principal.Identity.Name);
        if (string.IsNullOrWhiteSpace(nId))
        {
            return Task.FromResult(principal);
        }

        var identity = new ClaimsIdentity();
        identity.AddClaim(new Claim(LoadedClaimType, "true"));
        identity.AddClaim(new Claim(NidClaimType, nId));
        identity.AddClaim(new Claim(ClaimTypes.Role, "User"));

        principal.AddIdentity(identity);
        return Task.FromResult(principal);
    }

    private static string ExtractNId(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return string.Empty;
        }

        var parts = name.Split('\\', StringSplitOptions.RemoveEmptyEntries);
        return (parts.Length > 0 ? parts[^1] : name).Trim().ToUpperInvariant();
    }
}
