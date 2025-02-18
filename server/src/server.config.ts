import { defineServerConfig } from './utils/ServerConfigHandler'

const ServerConfig = defineServerConfig({
	locale: {
		enable: true,
		defaultLang: 'vi',
		defaultCountry: 'vn',
		routes: {
			'/login': {
				enable: false,
			},
		},
	},
	crawler: 'http://localhost:8084',
})

export default ServerConfig
