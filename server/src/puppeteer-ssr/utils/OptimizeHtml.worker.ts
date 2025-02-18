import { minify } from 'html-minifier'
import workerpool from 'workerpool'
import { brotliDecompressSync } from 'zlib'
import { POWER_LEVEL, POWER_LEVEL_LIST } from '../../constants'
import { ENV } from '../../utils/InitEnv'
import {
	DISABLE_COMPRESS_HTML,
	DISABLE_DEEP_OPTIMIZE,
	DISABLE_OPTIMIZE,
	regexHandleAttrsHtmlTag,
	regexHandleAttrsImageTag,
	regexHandleAttrsInteractiveTag,
	regexOptimizeForPerformanceHardly,
	regexOptimizeForPerformanceNormally,
	regexOptimizeForScriptBlockPerformance,
} from '../constants'

const compressContent = (html: string, isForce = false): string => {
	if (!html) return ''
	if (Buffer.isBuffer(html)) html = brotliDecompressSync(html).toString()

	if (
		(DISABLE_COMPRESS_HTML && !isForce) ||
		POWER_LEVEL === POWER_LEVEL_LIST.ONE
	)
		return html

	if (ENV !== 'development') {
		html = minify(html, {
			collapseBooleanAttributes: true,
			collapseInlineTagWhitespace: true,
			collapseWhitespace: true,
			removeAttributeQuotes: true,
			removeComments: true,
			removeEmptyAttributes: true,
			removeEmptyElements: true,
			useShortDoctype: true,
		})
	}

	return html
} // compressContent

const optimizeContent = (
	html: string,
	isFullOptimize = false,
	isForce = false
): string => {
	if (!html) return ''
	if (Buffer.isBuffer(html)) html = brotliDecompressSync(html).toString()

	if (DISABLE_OPTIMIZE && !isForce) return html

	html = html.replace(regexOptimizeForScriptBlockPerformance, '')
	html = html.replace(regexOptimizeForPerformanceNormally, '')

	if (
		(DISABLE_DEEP_OPTIMIZE && !isForce) ||
		POWER_LEVEL === POWER_LEVEL_LIST.ONE
	)
		return html
	else if (isFullOptimize) {
		html = html
			.replace(regexOptimizeForPerformanceHardly, '')
			.replace(regexHandleAttrsHtmlTag, (match, tag, curAttrs) => {
				let newAttrs = curAttrs

				if (newAttrs.indexOf('lang') === -1) {
					newAttrs = `lang="en"`
				}

				return `<html ${newAttrs}>`
			})
			.replace(regexHandleAttrsImageTag, (match, tag, curAttrs) => {
				const alt = /alt=("|'|)(?<alt>[^"']+)("|'|)+(\s|$)/g
					.exec(curAttrs)
					?.groups?.alt?.trim()

				if (!alt) return ''

				let newAttrs = (
					curAttrs.indexOf('seo-tag') !== -1
						? curAttrs
						: curAttrs.replace(
								/(?<srcAttr>(src|srcset))=("|'|)(.*?)("|'|)+(\s|$)/g,
								'$<srcAttr> '
						  )
				).trim()

				switch (true) {
					case newAttrs.indexOf('height=') === -1:
						newAttrs = `height="200" ${newAttrs}`
					case newAttrs.indexOf('width=') === -1:
						newAttrs = `width="150" ${newAttrs}`
					default:
						break
				}

				return `<img ${newAttrs}>`
			})
			.replace(
				regexHandleAttrsInteractiveTag,
				(math, tag, curAttrs, negative, content, endTag) => {
					let newAttrs = `style="display: inline-block;min-width: 48px;min-height: 48px;" ${curAttrs.trim()}`
					let newTag = tag
					let tmpEndTag = tag === 'input' ? '' : endTag === tag ? endTag : tag
					let tmpContent = content
					let result

					switch (true) {
						case newTag === 'a' && curAttrs.indexOf('href=') === -1:
							newTag = 'button'
							newAttrs = `type="button" ${newAttrs}`
							tmpEndTag = 'button'
							break
						case newTag === 'a' && /href(\s|$)|href=""/g.test(curAttrs):
							newTag = 'button'
							newAttrs = `type="button" ${newAttrs.replace(
								/href(\s|$)|href=""/g,
								''
							)}`
							tmpEndTag = 'button'
							break
						default:
							break
					}

					switch (true) {
						case newTag === 'a':
							const href = /href=("|'|)(?<href>.*?)("|'|)+(\s|$)/g.exec(
								curAttrs
							)?.groups?.href
							tmpContent = tmpContent.replace(
								/[Cc]lick here|[Cc]lick this|[Gg]o|[Hh]ere|[Tt]his|[Ss]tart|[Rr]ight here|[Mm]ore|[Ll]earn more/g,
								''
							)

							const tmpContentWithTrim = tmpContent
								.replace(/([\n]|<!--(\s[^>]+)*-->)/g, '')
								.trim()

							if (!tmpContentWithTrim.replace(/<[^>]*>/g, ''))
								tmpContent = `${tmpContentWithTrim} ${href}`

							if (curAttrs.indexOf('aria-label=') !== -1) {
								const ariaLabel =
									/aria-label=("|'|)(?<ariaLabel>[^"']+)("|'|)+(\s|$)/g.exec(
										curAttrs
									)?.groups?.ariaLabel

								if (ariaLabel !== tmpContent)
									newAttrs = curAttrs.replace(
										/aria-label=("|'|)(?<ariaLabel>[^"']+)("|'|)+(\s|$)/g,
										''
									)
							}

							break
						case newTag === 'button':
							const tmpContentWithoutHTMLTags = tmpContent
								.replace(/<[^>]*>|[\n]/g, '')
								.trim()

							if (!tmpContentWithoutHTMLTags) return ''
							if (curAttrs.indexOf('type=') === -1)
								newAttrs = `type="button" ${newAttrs}`

							if (curAttrs.indexOf('aria-label=') !== -1) {
								const ariaLabel =
									/aria-label=("|'|)(?<ariaLabel>[^"']+)("|'|)+(\s|$)/g.exec(
										curAttrs
									)?.groups?.ariaLabel

								tmpContent = ariaLabel
							} else {
								newAttrs = `aria-label="${tmpContentWithoutHTMLTags}" ${newAttrs}`
								tmpContent = tmpContentWithoutHTMLTags
							}
							break
						case newTag === 'input' &&
							/type=['"](button|submit)['"]/g.test(curAttrs) &&
							!/value(\s|$)|value=['"]{2}/g.test(curAttrs):
							return ''
						case newTag === 'input' &&
							/id=("|'|)(.*?)("|'|)+(\s|$)/g.test(newAttrs):
							const id = /id=("|'|)(?<id>.*?)("|'|)+(\s|$)/g.test(newAttrs)
							result = `<label for=${id}><${newTag} ${newAttrs}>${tmpContent}</${tmpEndTag}>`
							break
						default:
							break
					}

					result =
						result || tmpEndTag
							? `<${newTag} ${newAttrs} ${negative}>${tmpContent}</${tmpEndTag}>`
							: `<${newTag} ${negative} ${newAttrs}>`

					return result
				}
			)
	}

	return html
}

// create a worker and register public functions
workerpool.worker({
	compressContent,
	optimizeContent,
})
