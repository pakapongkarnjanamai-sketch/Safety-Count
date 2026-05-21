using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Data;
using SafetyCount.Api.Options;
using SafetyCount.Api.Services;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddHttpContextAccessor();
builder.Services.Configure<BadgeFileSettings>(builder.Configuration.GetSection(BadgeFileSettings.SectionName));
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection(EmailSettings.SectionName));

var domainPrefix = builder.Configuration["DomainSettings:DomainPrefix"]
    ?? throw new InvalidOperationException("DomainSettings:DomainPrefix configuration is required.");
var corsOrigins = builder.Configuration.GetSection("CorsOrigins")
    .GetChildren()
    .Select(x => x.Value)
    .Where(x => !string.IsNullOrWhiteSpace(x))
    .Select(x => x!)
    .ToArray();

builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
    .AddNegotiate();

builder.Services.Configure<IISOptions>(options =>
{
    options.AutomaticAuthentication = true;
    options.AuthenticationDisplayName = "Windows";
});

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .RequireAssertion(ctx =>
            ctx.User.Identity?.Name?.StartsWith(domainPrefix, StringComparison.OrdinalIgnoreCase) == true)
        .Build();

    options.AddPolicy("DomainUser", policy => policy.RequireAssertion(ctx =>
        ctx.User.Identity?.Name?.StartsWith(domainPrefix, StringComparison.OrdinalIgnoreCase) == true));
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("SafetyCountCors", policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Server=(localdb)\\mssqllocaldb;Database=SafetyCountDb;Trusted_Connection=True;TrustServerCertificate=True"));

builder.Services.AddScoped<IBadgeFileReaderService, BadgeFileReaderService>();
builder.Services.AddScoped<IBadgeAttendanceService, BadgeAttendanceService>();
builder.Services.AddScoped<IEmailSenderService, EmailSenderService>();
builder.Services.AddScoped<IClaimsTransformation, WindowsClaimsTransformation>();
builder.Services.AddHttpClient("EmployeeService", client =>
{
    client.BaseAddress = new Uri("https://ap-ntc2138-qawb/");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();
app.UseCors("SafetyCountCors");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program;
