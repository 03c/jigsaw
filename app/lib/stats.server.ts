import si from "systeminformation";
import { docker } from "./docker.server";

export interface ServerStats {
  cpu: {
    manufacturer: string;
    brand: string;
    cores: number;
    currentLoad: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  }[];
  network: {
    iface: string;
    rx_sec: number;
    tx_sec: number;
  }[];
  uptime: number;
  os: {
    platform: string;
    distro: string;
    release: string;
    kernel: string;
    hostname: string;
  };
}

/**
 * Collect comprehensive server statistics.
 */
export async function getServerStats(): Promise<ServerStats> {
  const [cpuData, cpuLoad, mem, disks, netStats, osInfo, time] =
    await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.osInfo(),
      si.time(),
    ]);

  return {
    cpu: {
      manufacturer: cpuData.manufacturer,
      brand: cpuData.brand,
      cores: cpuData.cores,
      currentLoad: Math.round(cpuLoad.currentLoad * 100) / 100,
    },
    memory: {
      total: mem.total,
      used: mem.used,
      free: mem.free,
      usedPercent: Math.round((mem.used / mem.total) * 10000) / 100,
    },
    disk: disks.map((d) => ({
      total: d.size,
      used: d.used,
      free: d.available,
      usedPercent: Math.round(d.use * 100) / 100,
    })),
    network: netStats
      .filter((n) => n.iface !== "lo")
      .map((n) => ({
        iface: n.iface,
        rx_sec: n.rx_sec,
        tx_sec: n.tx_sec,
      })),
    uptime: time.uptime,
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      kernel: osInfo.kernel,
      hostname: osInfo.hostname,
    },
  };
}

export interface DockerStats {
  containersRunning: number;
  containersStopped: number;
  images: number;
  serverVersion: string;
  memoryLimit: number;
  cpuCount: number;
}

/**
 * Get Docker engine statistics.
 */
export async function getDockerStats(): Promise<DockerStats> {
  const info = await docker.info();
  return {
    containersRunning: info.ContainersRunning || 0,
    containersStopped: info.ContainersStopped || 0,
    images: info.Images || 0,
    serverVersion: info.ServerVersion || "unknown",
    memoryLimit: info.MemTotal || 0,
    cpuCount: info.NCPU || 0,
  };
}
