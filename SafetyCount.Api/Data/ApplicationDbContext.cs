using Microsoft.EntityFrameworkCore;
using SafetyCount.Api.Models;

namespace SafetyCount.Api.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    public DbSet<Employee> Employees => Set<Employee>();

    public DbSet<DailyAttendance> DailyAttendances => Set<DailyAttendance>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DailyAttendance>()
            .HasIndex(x => new { x.EmployeeId, x.Date })
            .IsUnique();

        modelBuilder.Entity<Employee>()
            .Property(x => x.RequiresBadgeSwipe)
            .HasDefaultValue(true);
    }
}
