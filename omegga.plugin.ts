import OmeggaPlugin, { OL, PS, PC, OmeggaPlayer } from 'omegga';
import fs from 'fs';

type Config = { cooldown: number };
type Storage = { bar: string };

const FILE_PATH = __dirname + '/../roles.txt';

let cooldowns = {}

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
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

  async checkRoles(plr: OmeggaPlayer): Promise<string[]> {
    const playerRoles = plr.getRoles();

    const match = this.roleNames.filter(v => playerRoles.includes(v));

    return match;
  }

  async init() {
    //const FILE_PATH = __dirname + '/../roles.txt'

    if (!fs.existsSync(FILE_PATH)) {
      throw Error('Unable to find file "roles.txt" in plugin.');
    }

    this.roleNames = fs.readFileSync(FILE_PATH, 'utf-8').split('\n');
    this.roleNames.splice(0, 1);
    if (this.roleNames.length == 1 && this.roleNames[0] === '') {
      console.warn('role.txt contains no roles!');
      return;
    }

    this.omegga.on('join', async (player) => {
      // Delay is used to wait for the OmeggaPlayer with the proper methods needed to appear on the server
      setTimeout(async () => {
        const plr = this.omegga.getPlayer(player.name)
        if ((await this.checkRoles(plr)).length <= 0) {
          this.omegga.whisper(plr, 'You have been assigned a random colored role!');
          this.omegga.whisper(plr, 'Use <code>/namecolors</> to see the avalible colors, and <code>/chagecolor [color]</> to change it.');
          const max = this.roleNames.length;
          const R = getRandomInt(0, max - 1);

          this.omegga.writeln(`Chat.Command /GrantRole "${this.roleNames[R]}" "${plr.name}"`);
        }
      }, 500);
    });

    // Commands
    this.omegga.on('cmd:changecolor', async (speaker: string, toColor: string) => {
      if (cooldowns.hasOwnProperty(speaker) && (Date.now() - cooldowns[speaker]) < (this.config.cooldown * 1000)) {
        this.omegga.whisper(speaker, 'You are on cooldown!');
        return;
      }

      cooldowns[speaker] = Date.now();

      const plr = this.omegga.getPlayer(speaker);

      const currentColorRoles = await this.checkRoles(plr);

      currentColorRoles.forEach((role) => {
        this.omegga.writeln(`Chat.Command /RevokeRole "${role}" "${plr.name}"`);
      });

      this.omegga.whisper(plr, 'Updated color');

      this.omegga.writeln(`Chat.Command /GrantRole "${toColor}" "${plr.name}"`);
    });

    this.omegga.on('cmd:namecolors', (speaker: string) => {
      this.omegga.whisper(speaker, 'Current color roles:');
      this.roleNames.forEach((role) => {
        this.omegga.whisper(speaker, `- ${role}`);
      });
    });

    return { registeredCommands: ['changecolor', 'namecolors'] };
  }

  async stop() { }
}
