using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Data;
using SafetyCount.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Server=(localdb)\\mssqllocaldb;Database=SafetyCountDb;Trusted_Connection=True;TrustServerCertificate=True"));

builder.Services.AddScoped<IBadgeFileReaderService, BadgeFileReaderService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.MapControllers();

app.Run();

public partial class Program;
