using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Data;
using SafetyCount.Api.Services;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Server=(localdb)\\mssqllocaldb;Database=SafetyCountDb;Trusted_Connection=True;TrustServerCertificate=True"));

builder.Services.AddScoped<IBadgeFileReaderService, BadgeFileReaderService>();
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
app.MapControllers();

app.Run();

public partial class Program;
