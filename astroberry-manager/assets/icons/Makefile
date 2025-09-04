ICONS := \
	astroberry-16x16.png \
	astroberry-24x24.png \
	astroberry-32x32.png \
	astroberry-48x48.png \
	astroberry-64x64.png

ANDROID_LAUNCHER := \
	astroberry-48x48.png \
	astroberry-72x72.png \
	astroberry-96x96.png \
	astroberry-144x144.png \
	astroberry-192x192.png

IPHONE_LAUNCHER := \
	astroberry-60x60.png \
	astroberry-120x120.png

IPAD_LAUNCHER := \
	astroberry-76x76.png \
	astroberry-152x152.png

ALL_ICONS := $(ICONS) $(ANDROID_LAUNCHER) $(IPHONE_LAUNCHER) $(IPAD_LAUNCHER)

all: $(ALL_ICONS)

astroberry-16x16.png: astroberry-icon-sm.svg
	convert -density 90 \
		-background transparent "$<" "$@"
astroberry-24x24.png: astroberry-icon-sm.svg
	convert -density 135 \
		-background transparent "$<" "$@"
astroberry-32x32.png: astroberry-icon-sm.svg
	convert -density 180 \
		-background transparent "$<" "$@"

astroberry-%.png: astroberry-icon.svg
	convert -density $$[`echo $* | cut -d x -f 1` * 90 / 48] \
		-background transparent "$<" "$@"

clean:
	rm -f *.png
