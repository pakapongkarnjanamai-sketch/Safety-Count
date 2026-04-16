using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafetyCount.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeRequiresBadgeSwipe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RequiresBadgeSwipe",
                table: "Employees",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RequiresBadgeSwipe",
                table: "Employees");
        }
    }
}
