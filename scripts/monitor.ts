import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KravtradeLaunchpad } from "../target/types/kravtrade_launchpad";
import {
    Connection,
    PublicKey,
    clusterApiUrl,
    LAMPORTS_PER_SOL
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

/**
 * Monitoring and health check utilities
 */

interface MonitoringConfig {
    cluster: string;
    programId: string;
    platformConfigPda: string;
    checkInterval: number; // seconds
    alertThresholds: {
        lowBalance: number; // lamports
        highFailureRate: number; // percentage
    };
}

interface HealthCheckResult {
    timestamp: string;
    programStatus: "healthy" | "warning" | "error";
    platformStatus: "operational" | "paused" | "error";
    totalLaunches: number;
    activeLaunches: number;
    totalRaised: number;
    issues: string[];
}

class LaunchpadMonitor {
    private connection: Connection;
    private program: Program<KravtradeLaunchpad>;
    private config: MonitoringConfig;

    constructor(config: MonitoringConfig) {
        this.config = config;

        if (config.cluster === "localnet") {
            this.connection = new Connection("http://127.0.0.1:8899", "confirmed");
        } else {
            this.connection = new Connection(clusterApiUrl(config.cluster as any), "confirmed");
        }

        // In a real implementation, you would set up the program properly
        // const provider = new anchor.AnchorProvider(this.connection, wallet, {});
        // this.program = new Program(IDL, config.programId, provider);
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck(): Promise<HealthCheckResult> {
        const timestamp = new Date().toISOString();
        const issues: string[] = [];
        let programStatus: "healthy" | "warning" | "error" = "healthy";
        let platformStatus: "operational" | "paused" | "error" = "operational";

        try {
            // Check program account exists
            const programInfo = await this.connection.getAccountInfo(
                new PublicKey(this.config.programId)
            );

            if (!programInfo) {
                issues.push("Program account not found");
                programStatus = "error";
            }

            // Check platform configuration
            let platformConfig;
            try {
                platformConfig = await this.program.account.platformConfig.fetch(
                    new PublicKey(this.config.platformConfigPda)
                );

                if (platformConfig.isPaused) {
                    platformStatus = "paused";
                    issues.push("Platform is paused");
                }
            } catch (error) {
                issues.push("Failed to fetch platform config");
                platformStatus = "error";
            }

            // Check admin balance
            if (platformConfig) {
                const adminBalance = await this.connection.getBalance(platformConfig.admin);
                if (adminBalance < this.config.alertThresholds.lowBalance) {
                    issues.push(`Admin balance low: ${adminBalance / LAMPORTS_PER_SOL} SOL`);
                    programStatus = "warning";
                }
            }

            // Get platform statistics
            const totalLaunches = platformConfig?.totalLaunches?.toNumber() || 0;
            const totalRaised = platformConfig?.totalRaised?.toNumber() || 0;

            // Count active launches (would need to implement launch enumeration)
            const activeLaunches = await this.countActiveLaunches();

            return {
                timestamp,
                programStatus,
                platformStatus,
                totalLaunches,
                activeLaunches,
                totalRaised,
                issues,
            };

        } catch (error) {
            issues.push(`Health check failed: ${error}`);
            return {
                timestamp,
                programStatus: "error",
                platformStatus: "error",
                totalLaunches: 0,
                activeLaunches: 0,
                totalRaised: 0,
                issues,
            };
        }
    }

    /**
     * Count active launches
     */
    private async countActiveLaunches(): Promise<number> {
        // This would require implementing a way to enumerate all launches
        // For now, return 0 as placeholder
        return 0;
    }

    /**
     * Monitor launch activity
     */
    async monitorLaunchActivity(launchId: number): Promise<void> {
        try {
            const [launchConfigPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("launch"),
                    new anchor.BN(launchId).toArrayLike(Buffer, "le", 8),
                ],
                new PublicKey(this.config.programId)
            );

            const launchConfig = await this.program.account.launchConfig.fetch(launchConfigPda);

            console.log(`Launch ${launchId} Status:`);
            console.log(`- Status: ${Object.keys(launchConfig.status)[0]}`);
            console.log(`- Total Raised: ${launchConfig.totalRaised.toNumber() / LAMPORTS_PER_SOL} SOL`);
            console.log(`- Contributors: ${launchConfig.contributorCount}`);
            console.log(`- Soft Cap Progress: ${(launchConfig.totalRaised.toNumber() / launchConfig.softCap.toNumber() * 100).toFixed(2)}%`);
            console.log(`- Hard Cap Progress: ${(launchConfig.totalRaised.toNumber() / launchConfig.hardCap.toNumber() * 100).toFixed(2)}%`);

        } catch (error) {
            console.error(`Failed to monitor launch ${launchId}:`, error);
        }
    }

    /**
     * Generate monitoring report
     */
    async generateReport(): Promise<void> {
        const healthCheck = await this.performHealthCheck();

        console.log("=== Launchpad Monitoring Report ===");
        console.log(`Timestamp: ${healthCheck.timestamp}`);
        console.log(`Program Status: ${healthCheck.programStatus}`);
        console.log(`Platform Status: ${healthCheck.platformStatus}`);
        console.log(`Total Launches: ${healthCheck.totalLaunches}`);
        console.log(`Active Launches: ${healthCheck.activeLaunches}`);
        console.log(`Total Raised: ${healthCheck.totalRaised / LAMPORTS_PER_SOL} SOL`);

        if (healthCheck.issues.length > 0) {
            console.log("\n⚠️  Issues Detected:");
            healthCheck.issues.forEach(issue => console.log(`- ${issue}`));
        } else {
            console.log("\n✅ No issues detected");
        }

        // Save report to file
        const reportPath = path.join(__dirname, `../reports/health-${Date.now()}.json`);
        const dir = path.dirname(reportPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(reportPath, JSON.stringify(healthCheck, null, 2));
        console.log(`\nReport saved to: ${reportPath}`);
    }

    /**
     * Start continuous monitoring
     */
    startMonitoring(): void {
        console.log(`Starting monitoring with ${this.config.checkInterval}s interval...`);

        setInterval(async () => {
            try {
                await this.generateReport();
            } catch (error) {
                console.error("Monitoring error:", error);
            }
        }, this.config.checkInterval * 1000);
    }
}

/**
 * Load monitoring configuration
 */
function loadMonitoringConfig(cluster: string): MonitoringConfig {
    const deploymentPath = path.join(__dirname, `../deployments/${cluster}.json`);

    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`No deployment found for ${cluster}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    return {
        cluster,
        programId: deployment.programId,
        platformConfigPda: deployment.platformConfigPda,
        checkInterval: 300, // 5 minutes
        alertThresholds: {
            lowBalance: 0.1 * LAMPORTS_PER_SOL, // 0.1 SOL
            highFailureRate: 10, // 10%
        },
    };
}

/**
 * Main monitoring functions
 */
async function main() {
    const command = process.argv[2];
    const cluster = process.env.CLUSTER || "localnet";

    try {
        const config = loadMonitoringConfig(cluster);
        const monitor = new LaunchpadMonitor(config);

        switch (command) {
            case "health":
                await monitor.generateReport();
                break;

            case "launch":
                const launchId = parseInt(process.argv[3]);
                if (isNaN(launchId)) {
                    console.error("Please provide a valid launch ID");
                    process.exit(1);
                }
                await monitor.monitorLaunchActivity(launchId);
                break;

            case "start":
                monitor.startMonitoring();
                break;

            default:
                console.log("Usage:");
                console.log("  npm run monitor health          - Generate health report");
                console.log("  npm run monitor launch <id>     - Monitor specific launch");
                console.log("  npm run monitor start           - Start continuous monitoring");
                console.log("");
                console.log("Environment variables:");
                console.log("  CLUSTER - Target cluster (localnet, devnet, testnet, mainnet-beta)");
                break;
        }
    } catch (error) {
        console.error("Monitoring failed:", error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
});