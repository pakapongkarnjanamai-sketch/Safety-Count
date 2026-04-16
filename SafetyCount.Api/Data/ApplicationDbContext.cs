using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Models;

namespace SafetyCount.Api.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    public DbSet<Department> Departments => Set<Department>();

    public DbSet<Employee> Employees => Set<Employee>();

    public DbSet<CheckIn> CheckIns => Set<CheckIn>();

    public DbSet<DailyAttendance> DailyAttendances => Set<DailyAttendance>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DailyAttendance>()
            .HasIndex(x => new { x.EmployeeId, x.Date })
            .IsUnique();
    }
}
