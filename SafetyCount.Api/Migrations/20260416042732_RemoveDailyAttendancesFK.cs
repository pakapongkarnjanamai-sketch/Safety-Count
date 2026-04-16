using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafetyCount.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDailyAttendancesFK : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DailyAttendances_Employees_EmployeeId",
                table: "DailyAttendances");

            migrationBuilder.DropIndex(
                name: "IX_DailyAttendances_EmployeeId",
                table: "DailyAttendances");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "DailyAttendances");

            migrationBuilder.AddColumn<int>(
                name: "EmployeeId",
                table: "DailyAttendances",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_DailyAttendances_EmployeeId_Date",
                table: "DailyAttendances",
                columns: new[] { "EmployeeId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DailyAttendances_EmployeeId_Date",
                table: "DailyAttendances");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "DailyAttendances");

            migrationBuilder.AddColumn<int>(
                name: "EmployeeId",
                table: "DailyAttendances",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_DailyAttendances_EmployeeId",
                table: "DailyAttendances",
                column: "EmployeeId");

            migrationBuilder.AddForeignKey(
                name: "FK_DailyAttendances_Employees_EmployeeId",
                table: "DailyAttendances",
                column: "EmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
