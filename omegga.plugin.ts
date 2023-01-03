import OmeggaPlugin, { OL, PS, PC, OmeggaPlayer } from 'omegga';
import fs from 'fs';

type Config = { cooldown: number };
type Storage = { bar: string };

// Path for roles.txt
const FILE_PATH = __dirname + '/../roles.txt';

let cooldowns = {}

// Gets a random int between min and max (inclusive)
function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Converts a number to hex
function toHex(v: number): string {
  const hex = v.toString(16);
  return hex.length == 1 ? '0' + hex : hex;
}

export default class Plugin implements OmeggaPlugin<Config, Storage> {
  omegga: OL;
  config: PC<Config>;
  store: PS<Storage>;

  constructor(omegga: OL, config: PC<Config>, store: PS<Storage>) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
  }

  private roleNames = [];
  private roleColors = {};

  // Check a player's roles to see if they already have a color
  async checkRoles(plr: OmeggaPlayer): Promise<string[]> {
    const playerRoles = plr.getRoles();

    const match = this.roleNames.filter(v => playerRoles.includes(v));

    return match;
  }

  async init() {
    if (!fs.existsSync(FILE_PATH)) {
      throw Error('Unable to find file "roles.txt" in plugin.');
    }

    // Read from roles.txt, split by newline and remove the first line
    this.roleNames = fs.readFileSync(FILE_PATH, 'utf-8').split('\n');
    this.roleNames.splice(0, 1);
    if (this.roleNames.length == 1 && this.roleNames[0] === '') {
      console.warn('role.txt contains no roles!');
      return;
    }

    const allRoles = this.omegga.getRoleSetup();
    let nonColorRoles = [];

    // Gets the colors of the roles in roles.txt
    allRoles.roles.forEach((role) => {
      const idx = this.roleNames.indexOf(role.name)

      if (idx != -1) {
        const R = role.color.r;
        const G = role.color.g;
        const B = role.color.b;

        this.roleColors[role.name] = toHex(R) + toHex(G) + toHex(B);
      } else nonColorRoles[nonColorRoles.length] = role.name.toLowerCase();
    });

    // Ensure roles.txt is accurate to the roles on the server
    const keys = Object.keys(this.roleColors)
    if (keys.length != this.roleNames.length) {
      const mismatch = this.roleNames.filter(v => !keys.includes(v));
      console.error('Mismatch in server roles and roles in file.');
      console.error(mismatch);
      return;
    }


    // Join and leave methods
    this.omegga.on('join', async (player) => {
      // Delay is used to wait for the OmeggaPlayer with the proper methods needed to appear on the server
      setTimeout(async () => {
        const plr = this.omegga.getPlayer(player.name)
        if ((await this.checkRoles(plr)).length <= 0) {
          this.omegga.whisper(plr, 'You have been assigned a random colored role!');
          this.omegga.whisper(plr, 'Use <code>/namecolors</> to see all available colors, and <code>/chagecolor [color]</> to change it.');
          const max = this.roleNames.length;
          const R = getRandomInt(0, max - 1);

          this.omegga.writeln(`Chat.Command /GrantRole "${this.roleNames[R]}" "${plr.name}"`);
        }
      }, 500);
    });

    this.omegga.on('leave', (player: OmeggaPlayer) => {
      if (cooldowns.hasOwnProperty(player.name)) delete cooldowns[player.name]; // Just to be clean
    });


    // Commands
    this.omegga.on('cmd:changecolor', async (speaker: string, toColor: string) => {
      if (cooldowns.hasOwnProperty(speaker) && (Date.now() - cooldowns[speaker]) < (this.config.cooldown * 1000)) {
        const diff = (Date.now() - cooldowns[speaker]) / 1000;
        const remaining = this.config.cooldown - Math.floor(diff);
        const formatted = new Date(remaining * 1000).toISOString().slice(14, 19);
        this.omegga.whisper(speaker, `You are on cooldown! <color="ffff00">${formatted}</> remaining.`);
        return;
      }

      if (nonColorRoles.includes(toColor.toLowerCase())) {
        this.omegga.whisper(speaker, '<color="ff0000">That role cannot be assigned. <emoji>contempt</>');
        return;
      }

      if (!this.roleNames.includes(toColor)) {
        this.omegga.whisper(speaker, 'Cannot find that color. <color="edf263">Ensure it\'s spelt correctly, role names are case-sensitive</>!');
        return;
      }

      cooldowns[speaker] = Date.now();

      const plr = this.omegga.getPlayer(speaker);

      const currentColorRoles = await this.checkRoles(plr);

      currentColorRoles.forEach((role) => {
        this.omegga.writeln(`Chat.Command /RevokeRole "${role}" "${plr.name}"`);
      });

      this.omegga.writeln(`Chat.Command /GrantRole "${toColor}" "${plr.name}"`);

      this.omegga.whisper(plr, `Updated your role color to <color="${this.roleColors[toColor]}">${toColor}</>!`);
    });

    this.omegga.on('cmd:namecolors', (speaker: string) => {
      this.omegga.whisper(speaker, 'Current color roles:');
      let output = [];
      let current = '';
      this.roleNames.forEach((role, i) => {
        const formatted = `<color="${this.roleColors[role]}">${role}</>${i >= this.roleNames.length ? '' : ', '}`

        if ((current + formatted).length > 512) {
          output.push(current);
          current = '';
        }
        current += formatted;
      });
      output.push(current);
      output.forEach((s) => {
        this.omegga.whisper(speaker, s);
      })
    });

    return { registeredCommands: ['changecolor', 'namecolors'] };
  }

  async stop() { }
}
