declare module 'passport-jwt' {
  export class Strategy {
    constructor(options: any, verify: Function);
  }
  export const ExtractJwt: {
    fromAuthHeaderAsBearerToken: () => any;
  };
}

declare module 'passport-local' {
  export class Strategy {
    constructor(options: any, verify: Function);
  }
}
