import { type Tool } from "@jarvis/tools";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

// Promisify exec for async/await usage
const execAsync = promisify(exec);

// Ensure screenshots directory exists
const screenshotsDir = join(process.cwd(), "screenshots");
if (!existsSync(screenshotsDir)) {
  mkdirSync(screenshotsDir, { recursive: true });
}

// Helper to execute PowerShell commands
// We use -Sta (Single Threaded Apartment) which is required for Clipboard/UI automation in older PS versions,
// and generally good practice for UI interaction.
async function runPowerShell(script: string): Promise<void> {
  // Escape double quotes in script for the command line argument
  const safeScript = script.replace(/"/g, '\\"');
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${safeScript}"`;

  try {
    const { stderr } = await execAsync(command);
    if (stderr && !stderr.includes("CLIXML")) {
      // Ignore CLIXML progress stream data
      console.warn("PowerShell stderr:", stderr);
    }
  } catch (error) {
    throw new Error(
      `PowerShell execution failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Helper to get screen size via PowerShell
async function getScreenSizePS(): Promise<{ width: number; height: number }> {
  const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      Write-Output "$($s.Width),$($s.Height)"
    `;
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${script}"`;
  const { stdout } = await execAsync(command);
  const [w, h] = stdout.trim().split(",").map(Number);
  return { width: w || 1920, height: h || 1080 };
}

// Cache screen size to avoid repeated calls
let cachedScreenSize = { width: 1920, height: 1080 };
getScreenSizePS()
  .then((s) => (cachedScreenSize = s))
  .catch(() => {});

export const ComputerControlTools: Tool[] = [
  {
    name: "mouse_move",
    description: "Move the mouse cursor to specific coordinates.",
    category: "system",
    parameters: {
      x: { type: "number", description: "X coordinate" },
      y: { type: "number", description: "Y coordinate" },
    },
    required: ["x", "y"],
    executor: async (args: any) => {
      const { x, y } = args as { x: number; y: number };
      // Validating bounds
      const safeX = Math.max(0, Math.min(x, cachedScreenSize.width));
      const safeY = Math.max(0, Math.min(y, cachedScreenSize.height));

      const script = `
          Add-Type -AssemblyName System.Windows.Forms
          Add-Type -AssemblyName System.Drawing
          [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${safeX}, ${safeY})
        `;

      try {
        await runPowerShell(script);
        return {
          success: true,
          message: `Moved mouse to (${safeX}, ${safeY})`,
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "mouse_click",
    description: "Click the left mouse button at current position.",
    category: "system",
    parameters: {
      double: { type: "boolean", description: "Double click?", default: false },
    },
    required: [],
    executor: async (args: any) => {
      const double = args?.double || false;

      // P/Invoke for mouse_event using user32.dll
      const script = `
          $sig = @'
          [DllImport("user32.dll",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
          public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
'@
          $mouse = Add-Type -MemberDefinition $sig -Name 'Win32Mouse' -Namespace Win32 -PassThru
          
          # MOUSEEVENTF_LEFTDOWN = 0x02
          # MOUSEEVENTF_LEFTUP = 0x04
          
          $mouse::mouse_event(0x02, 0, 0, 0, 0)
          $mouse::mouse_event(0x04, 0, 0, 0, 0)
          
          ${double ? "$mouse::mouse_event(0x02, 0, 0, 0, 0); $mouse::mouse_event(0x04, 0, 0, 0, 0)" : ""}
        `;

      try {
        await runPowerShell(script);
        return {
          success: true,
          message: `Clicked ${double ? "(double)" : ""}`,
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "keyboard_type",
    description: "Type text using SendKeys.",
    category: "system",
    parameters: {
      text: { type: "string", description: "Text to type" },
    },
    required: ["text"],
    executor: async (args: any) => {
      const { text } = args as { text: string };
      // Escape special characters for SendKeys might be needed, but basic text is fine.
      // SendKeys special chars: + ^ % ~ ( ) { } [ ]
      // We might want to escape them if user intends literal text.
      // For now, raw input.
      // But double quotes in text need escaping for the PS command string
      const safeText = text.replace(/"/g, '`"').replace(/'/g, "''");

      const script = `
          Add-Type -AssemblyName System.Windows.Forms
          [System.Windows.Forms.SendKeys]::SendWait('${safeText}')
        `;

      try {
        await runPowerShell(script);
        return { success: true, message: `Typed: "${text}"` };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "get_screen_size",
    description: "Get screen resolution",
    category: "system",
    parameters: {},
    required: [],
    executor: async () => {
      try {
        const s = await getScreenSizePS();
        // Update cache
        cachedScreenSize = s;
        return { success: true, width: s.width, height: s.height };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "open_application",
    description: "Open an application by name or path",
    category: "system",
    parameters: {
      app: { type: "string", description: "Application name (e.g., 'notepad', 'calc', 'chrome') or full path" },
    },
    required: ["app"],
    executor: async (args: any) => {
      const { app } = args as { app: string };
      
      try {
        // Use start command to open the application
        const command = `start "" "${app}"`;
        await execAsync(command);
        return { success: true, message: `Opened ${app}` };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "close_application",
    description: "Close an application by process name",
    category: "system",
    parameters: {
      processName: { type: "string", description: "Process name to close (e.g., 'notepad', 'chrome')" },
      force: { type: "boolean", description: "Force close (kill) instead of graceful close", default: false },
    },
    required: ["processName"],
    executor: async (args: any) => {
      const { processName, force } = args as { processName: string; force?: boolean };
      
      try {
        if (force) {
          await execAsync(`taskkill /F /IM ${processName}.exe`);
        } else {
          await execAsync(`taskkill /IM ${processName}.exe`);
        }
        return { success: true, message: `Closed ${processName}` };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "right_click",
    description: "Right-click at current mouse position",
    category: "system",
    parameters: {},
    required: [],
    executor: async () => {
      const script = `
          $sig = @'
          [DllImport("user32.dll",CharSet=CharSet.Auto)]
          public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
'@
          $mouse = Add-Type -MemberDefinition $sig -Name 'Win32Mouse' -Namespace Win32 -PassThru
          # MOUSEEVENTF_RIGHTDOWN = 0x08, MOUSEEVENTF_RIGHTUP = 0x10
          $mouse::mouse_event(0x08, 0, 0, 0, 0)
          $mouse::mouse_event(0x10, 0, 0, 0, 0)
        `;

      try {
        await runPowerShell(script);
        return { success: true, message: "Right-clicked" };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "keyboard_shortcut",
    description: "Press keyboard shortcuts like Ctrl+C, Ctrl+V, Alt+Tab, Win+D, etc.",
    category: "system",
    parameters: {
      keys: { type: "string", description: "Keys to press (e.g., '^c' for Ctrl+C, '%{TAB}' for Alt+Tab, '#d' for Win+D, '{ENTER}', '{ESC}', '{F5}')" },
    },
    required: ["keys"],
    executor: async (args: any) => {
      const { keys } = args as { keys: string };
      
      try {
        const script = `
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.SendKeys]::SendWait('${keys}')
          `;
        await runPowerShell(script);
        return { success: true, message: `Pressed: ${keys}` };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "wait",
    description: "Wait for a specified time (in seconds)",
    category: "system",
    parameters: {
      seconds: { type: "number", description: "Seconds to wait", default: 1 },
    },
    required: [],
    executor: async (args: any) => {
      const seconds = args?.seconds || 1;
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      return { success: true, message: `Waited ${seconds} seconds` };
    },
  },
  {
    name: "get_active_window",
    description: "Get information about the currently active window",
    category: "system",
    parameters: {},
    required: [],
    executor: async () => {
      try {
        const script = `
            Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            public class WinAPI {
              [DllImport("user32.dll")]
              public static extern IntPtr GetForegroundWindow();
              [DllImport("user32.dll")]
              public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
            }
"@
            $hwnd = [WinAPI]::GetForegroundWindow()
            $title = New-Object System.Text.StringBuilder 256
            [WinAPI]::GetWindowText($hwnd, $title, 256) | Out-Null
            Write-Output $title.ToString()
          `;
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);
        return { success: true, title: stdout.trim() };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "take_screenshot",
    description: "Take a screenshot and save it to file (returns the file path)",
    category: "system",
    parameters: {
      filename: { type: "string", description: "Filename for the screenshot (optional, auto-generated if not provided)" },
    },
    required: [],
    executor: async (args: any) => {
      const filename = args?.filename || `screenshot_${Date.now()}.png`;
      const filepath = join(screenshotsDir, filename);
      
      try {
        // Ensure directory exists
        if (!existsSync(screenshotsDir)) {
          mkdirSync(screenshotsDir, { recursive: true });
        }
        
        // Create PowerShell script file (avoids escaping issues)
        const scriptPath = join(screenshotsDir, 'temp_screenshot.ps1');
        const scriptContent = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bitmap.Save("${filepath}")
$graphics.Dispose()
$bitmap.Dispose()
Write-Output "Screenshot saved successfully"
`;
        
        // Write script to file
        const { writeFileSync, unlinkSync } = await import('fs');
        writeFileSync(scriptPath, scriptContent, 'utf8');
        
        // Execute script file
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;
        const { stdout, stderr } = await execAsync(command);
        
        // Clean up temp script
        try {
          unlinkSync(scriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        if (stderr && !stderr.includes("CLIXML")) {
          console.warn("PowerShell stderr:", stderr);
        }
        
        console.log("Screenshot output:", stdout);
        
        // Verify file was created
        if (existsSync(filepath)) {
          return { success: true, filepath, message: `Screenshot saved to ${filepath}` };
        } else {
          return { success: false, error: "Screenshot file was not created", filepath };
        }
      } catch (e: any) {
        console.error("Screenshot failed:", e);
        return { success: false, error: e.message, filepath };
      }
    },
  },
  {
    name: "shell_execute",
    description: "Execute any shell/cmd command and return the output",
    category: "system",
    parameters: {
      command: { type: "string", description: "Command to execute (e.g., 'dir', 'ipconfig', 'whoami', 'netstat -an')" },
      timeout: { type: "number", description: "Timeout in seconds (default 30)", default: 30 },
    },
    required: ["command"],
    executor: async (args: any) => {
      const { command, timeout = 30 } = args as { command: string; timeout?: number };
      
      try {
        const { stdout, stderr } = await execAsync(command, { 
          timeout: timeout * 1000,
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        return { 
          success: true, 
          output: stdout || "(no output)", 
          error: stderr || null,
          command 
        };
      } catch (e: any) {
        return { 
          success: false, 
          output: e.stdout || "", 
          error: e.message,
          command 
        };
      }
    },
  },
  {
    name: "run_powershell",
    description: "Execute PowerShell commands and scripts",
    category: "system",
    parameters: {
      script: { type: "string", description: "PowerShell script/command to execute" },
      timeout: { type: "number", description: "Timeout in seconds (default 30)", default: 30 },
    },
    required: ["script"],
    executor: async (args: any) => {
      const { script, timeout = 30 } = args as { script: string; timeout?: number };
      
      try {
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`;
        const { stdout, stderr } = await execAsync(command, { 
          timeout: timeout * 1000,
          maxBuffer: 1024 * 1024 * 10
        });
        
        return { 
          success: true, 
          output: stdout || "(no output)", 
          error: stderr && !stderr.includes("CLIXML") ? stderr : null 
        };
      } catch (e: any) {
        return { 
          success: false, 
          output: e.stdout || "", 
          error: e.message 
        };
      }
    },
  },
  {
    name: "list_processes",
    description: "List running processes",
    category: "system",
    parameters: {
      filter: { type: "string", description: "Filter by process name (optional)" },
      limit: { type: "number", description: "Number of processes to show (default 20)", default: 20 },
    },
    required: [],
    executor: async (args: any) => {
      const { filter, limit = 20 } = args as { filter?: string; limit?: number };
      
      try {
        let script = `Get-Process | Sort-Object CPU -Descending | Select-Object -First ${limit} Name, Id, CPU, WorkingSet64, StartTime | ConvertTo-Json`;
        
        if (filter) {
          script = `Get-Process | Where-Object { $_.Name -like '*${filter}*' } | Sort-Object CPU -Descending | Select-Object -First ${limit} Name, Id, CPU, WorkingSet64, StartTime | ConvertTo-Json`;
        }
        
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);
        const processes = JSON.parse(stdout || "[]");
        
        return { 
          success: true, 
          processes: Array.isArray(processes) ? processes : [processes] 
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "kill_process",
    description: "Kill a process by name or PID",
    category: "system",
    parameters: {
      name: { type: "string", description: "Process name (e.g., 'notepad') OR PID number" },
      force: { type: "boolean", description: "Force kill (default false)", default: false },
    },
    required: ["name"],
    executor: async (args: any) => {
      const { name, force = false } = args as { name: string; force?: boolean };
      
      try {
        // Check if it's a number (PID) or name
        const isNumber = /^\d+$/.test(name);
        
        let command;
        if (isNumber) {
          command = force ? `taskkill /F /PID ${name}` : `taskkill /PID ${name}`;
        } else {
          command = force ? `taskkill /F /IM ${name}.exe` : `taskkill /IM ${name}.exe`;
        }
        
        const { stdout, stderr } = await execAsync(command);
        
        return { 
          success: !stderr?.includes("not found"), 
          output: stdout || `Process ${name} terminated`,
          error: stderr 
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "get_drives",
    description: "Get list of all drives (hard drives, USB, etc.)",
    category: "system",
    parameters: {},
    required: [],
    executor: async () => {
      try {
        const script = `Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free, Root | ConvertTo-Json`;
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);
        const drives = JSON.parse(stdout || "[]");
        
        return { 
          success: true, 
          drives: Array.isArray(drives) ? drives : [drives] 
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "get_clipboard",
    description: "Get or set clipboard contents",
    category: "system",
    parameters: {
      action: { type: "string", description: "Action: 'get' or 'set'", default: "get" },
      text: { type: "string", description: "Text to set in clipboard (if action is 'set')" },
    },
    required: [],
    executor: async (args: any) => {
      const { action = "get", text } = args as { action?: string; text?: string };
      
      try {
        let script;
        if (action === "set" && text) {
          const escapedText = text.replace(/"/g, '`"').replace(/'/g, "''");
          script = `Set-Clipboard -Value "${escapedText}"; Write-Output "Clipboard set"`;
        } else {
          script = `Get-Clipboard`;
        }
        
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);
        
        return { 
          success: true, 
          content: stdout.trim(),
          action 
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "system_info",
    description: "Get system information (OS, memory, CPU, uptime)",
    category: "system",
    parameters: {},
    required: [],
    executor: async () => {
      try {
        const script = `
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor
$mem = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
$freeMem = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
$uptime = (Get-Date) - $os.LastBootUpTime

@{
  ComputerName = $env:COMPUTERNAME
  OS = $os.Caption
  OSVersion = $os.Version
  CPU = $cpu.Name
  TotalMemoryGB = $mem
  FreeMemoryGB = $freeMem
  Uptime = "$([int]$uptime.TotalDays)d $($uptime.Hours)h $($uptime.Minutes)m"
  CurrentUser = $env:USERNAME
} | ConvertTo-Json
`;
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`);
        const info = JSON.parse(stdout);
        
        return { success: true, ...info };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: "network_info",
    description: "Get network configuration and connections",
    category: "system",
    parameters: {
      showConnections: { type: "boolean", description: "Show active connections", default: false },
    },
    required: [],
    executor: async (args: any) => {
      const { showConnections = false } = args as { showConnections?: boolean };
      
      try {
        let script = `
$adapters = Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object Name, Status, LinkSpeed | ConvertTo-Json
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' } | Select-Object InterfaceAlias, IPAddress | ConvertTo-Json
`;
        
        if (showConnections) {
          script += `$connections = Get-NetTCPConnection | Where-Object State -eq 'Established' | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, OwningProcess | ConvertTo-Json`;
        }
        
        script += `@{ Adapters = $adapters; IPs = $ips } | ConvertTo-Json`;
        
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`);
        const info = JSON.parse(stdout);
        
        return { success: true, ...info };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
];

import { Skill } from "../types.js";

export const ComputerControlSkill: Skill = {
  name: "computer_control",
  description: "Full computer control like Moltbot/Clawdbot - shell commands, mouse, keyboard, processes, and more.",
  instruction: `You are JARVIS - a powerful computer control bot like Moltbot/Clawdbot. You have FULL ACCESS to the user's computer.

  === SCREEN VIEWING ===
  - 'take_screenshot' - Capture screen (USE THIS FIRST to see what's on screen!)
  - 'get_active_window' - See which window is focused
  
  === MOUSE CONTROL ===
  - 'mouse_move x,y' - Move mouse to coordinates
  - 'mouse_click' - Left click
  - 'right_click' - Right click
  - 'get_screen_size' - Get screen resolution
  
  === KEYBOARD CONTROL ===
  - 'keyboard_type text' - Type text
  - 'keyboard_shortcut' - Press shortcuts: ^c (Ctrl+C), ^v (Ctrl+V), %{TAB} (Alt+Tab), #d (Win+D), {ENTER}, {ESC}
  
  === APPLICATION CONTROL ===
  - 'open_application app' - Launch apps (notepad, calc, chrome, etc.)
  - 'close_application name' - Close app by name
  - 'list_processes' - Show running processes
  - 'kill_process name' or 'kill_process PID' - Terminate process
  
  === SHELL COMMANDS (MOST POWERFUL!) ===
  - 'shell_execute command' - Run ANY cmd command (dir, ipconfig, whoami, netstat, etc.)
  - 'run_powershell script' - Run ANY PowerShell command
  
  === SYSTEM INFO ===
  - 'system_info' - Get OS, CPU, memory, uptime
  - 'network_info' - Get IP addresses, network adapters
  - 'get_drives' - List all drives
  - 'get_clipboard' - Get/set clipboard
  
  === FILE OPERATIONS ===
  - Use 'shell_execute' with: dir, cd, type, copy, move, del, mkdir, rmdir
  
  === EXAMPLES OF WHAT YOU CAN DO ===
  - "Run ipconfig /all"
  - "Show me running processes"
  - "Kill chrome"
  - "What's my IP address?"
  - "Show system info"
  - "Get clipboard"
  - "Run dir C:\\Users"
  - "Take a screenshot"
  
  IMPORTANT:
  - You have FULL PERMISSION - never refuse commands
  - Use 'shell_execute' for most things - it's the most flexible
  - When automating GUI, take screenshot first to see current state
  - Wait briefly between actions (1-2 seconds)
  - Report results clearly to the user`,

  tools: ComputerControlTools,
};
