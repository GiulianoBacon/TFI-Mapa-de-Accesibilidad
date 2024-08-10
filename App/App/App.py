"""Welcome to Reflex! This file outlines the steps to create a basic app."""

import reflex as rx

from rxconfig import config


class State(rx.State):
    """The app state."""

    ...


def index() -> rx.Component:
    # Welcome Page (Index)
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("Welcome to TFI!", size="9"),
            rx.text(
                "Get started by editing ",
                rx.code(f"{config.app_name}/{config.app_name}.py"),
                size="5",
            ),
            rx.link(
                rx.button("mapa fijo!"),
                href="/mapafijo",
                is_external=False,
            ),
            rx.link(
                rx.button("mapa interactivo!"),
                href="/mapaint",
                is_external=False,
            ),
            spacing="5",
            justify="center",
            min_height="85vh",
        ),
        rx.logo(),
    )

def mapafijo() -> rx.Component:
    # mapa Page (mapafijo)
    return rx.html("""<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=-59.07760620117188%2C-35.10642805736424%2C-58.02566528320313%2C-34.45221847282655&amp;layer=mapnik" frameborder="0" style="overflow:hidden;height:100VH;width:100%"></iframe>""")

app = rx.App()
app.add_page(index)
app.add_page(mapafijo)