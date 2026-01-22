---
layout: ../../../layouts/BlogPostLayout.astro
title: Rust concurrency with Mandelbrot Set
date: 2023-01-07
description: Exploring concurrency in Rust programming.
category: technical
tags: ["rust", "concurrency", "programming"]
---


Rust excels in concurrent programming by enforcing rules that prevent memory errors and data races. For example:

- **Mutexes**: Rust ensures you only access shared data when holding the lock and releases it automatically. In C/C++, this relationship is often left to comments.
- **Read-Only Data**: Rust prevents accidental modification of shared read-only data. In C/C++, the type system helps but is error-prone.
- **Ownership Transfer**: Rust guarantees you relinquish all access when transferring data between threads. In C/C++, you must manually ensure no further access, risking subtle bugs.

Rust’s strict rules make concurrent programming safer and more reliable.

### What the Mandelbrot Set Actually Is
When reading code, it’s helpful to have a concrete idea of what it’s trying to do,
so let’s take a short excursion into some pure mathematics.
We’ll start with a simple case and then add complicating details until we arrive at the calculation at the heart of the Mandelbrot set.

Here’s an infinite loop,

```rust
fn square_loop(mut x: f64) {
    loop {
        x = x * x;
    }
}
```
In practice, Rust might optimize away the computation of `x` if it's unused. However,
assuming the code runs as written, the value of `x` changes as follows:
squaring a number less than 1 shrinks it toward zero; squaring 1 keeps it at 1;
squaring a number greater than 1 grows it toward infinity; and squaring a negative number turns it positive,
following the same behavior as the previous cases.

The num crate on crate.io provides complex number type we can use, here is the entire cargo.toml

```toml
[package]
name = "mandelbrot"
version = "0.1.0"
edition = "2021"

# See more keys and their definitions at
# https://doc.rust-lang.org/cargo/reference/manifest.html

[dependencies]
num = "0.4"
```
we can write the penultimate version of our loop:

```rust
use num::Complex;

fn complex_square_add_loop(c: Complex<f64>) {
    let mut z = Complex { re: 0.0, im: 0.0 };
    loop {
        z = z * z + c;
    }
}
```
The infinite loop takes time to run, but there are two shortcuts for the impatient. First,
limiting the iterations still provides a good approximation of the set, with precision depending on the desired detail.
Second, if `z` ever exits the circle of radius 2 centered at the origin, it will inevitably escape to infinity.
This leads to the final version of our loop, the core of the program
```rust
use num::Complex;
/// return `None`.
fn escape_time(c: Complex<f64>, limit: usize) -> Option<usize> {
    let mut z = Complex { re: 0.0, im: 0.0 };
    for i in 0..limit {
        if z.norm_sqr() > 4.0 {
            return Some(i);
        }
        z = z * z + c;
    }

    None
}
```
The rest of the program is concerned with deciding which portion of the set to plot at what resolution and distributing the work across several threads to speed up the calculation
### Parsing Pair Command-Line Arguments

The program accepts command-line arguments to control the image resolution and the portion of the Mandelbrot set displayed.
Since these arguments share a common format, here’s a function to parse them:
```rust
use std::str::FromStr;

fn parse_pair<T: FromStr>(s: &str, separator: char) -> Option<(T, T)> {
    match s.find(separator) {
        None => None,
        Some(index) => {
            match (T::from_str(&s[..index]), T::from_str(&s[index + 1..])) {
                (Ok(l), Ok(r)) => Some((l, r)),
                _ => None
            }
        }
    }
}

#[test]
fn test_parse_pair() {
    assert_eq!(parse_pair::<i32>("",        ','), None);
    assert_eq!(parse_pair::<i32>("10,",     ','), None);
    assert_eq!(parse_pair::<i32>(",10",     ','), None);
    assert_eq!(parse_pair::<i32>("10,20",   ','), Some((10, 20)));
    assert_eq!(parse_pair::<i32>("10,20xy", ','), None);
    assert_eq!(parse_pair::<f64>("0.5x",    'x'), None);
    assert_eq!(parse_pair::<f64>("0.5x1.5", 'x'), Some((0.5, 1.5)));
}

```
Now that we have parse_pair, it’s easy to write a function to parse a pair of floating-point coordinates and return them as a Complex<f64> value:
```rust
fn parse_complex(s: &str) -> Option<Complex<f64>> {
    match parse_pair(s, ',') {
        Some((re, im)) => Some(Complex { re, im }),
        None => None
    }
}

#[test]
fn test_parse_complex() {
    assert_eq!(parse_complex("1.25,-0.0625"),
               Some(Complex { re: 1.25, im: -0.0625 }));
    assert_eq!(parse_complex(",-0.0625"), None);
}
```

### Mapping from Pixels to Complex Numbers

The program operates in two related coordinate spaces: each pixel in the image corresponds to a point on the complex plane.
The mapping between these spaces depends on the portion of the Mandelbrot set being plotted and the image resolution,
specified via command-line arguments.
The following function converts image coordinates to complex numbers:
```rust
fn pixel_to_point(bounds: (usize, usize),
                  pixel: (usize, usize),
                  upper_left: Complex<f64>,
                  lower_right: Complex<f64>)
    -> Complex<f64>
{
    let (width, height) = (lower_right.re - upper_left.re,
                           upper_left.im - lower_right.im);
    Complex {
        re: upper_left.re + pixel.0 as f64 * width  / bounds.0 as f64,
        im: upper_left.im - pixel.1 as f64 * height / bounds.1 as f64
    }
}

#[test]
fn test_pixel_to_point() {
    assert_eq!(pixel_to_point((100, 200), (25, 175),
                              Complex { re: -1.0, im:  1.0 },
                              Complex { re:  1.0, im: -1.0 }),
               Complex { re: -0.5, im: -0.75 });
}

```
### Plotting the Set
To plot the Mandelbrot set, we apply `escape_time` to each pixel's corresponding point on the complex plane and color the pixel based on the result:
```rust
fn render(pixels: &mut [u8],
          bounds: (usize, usize),
          upper_left: Complex<f64>,
          lower_right: Complex<f64>)
{
    assert!(pixels.len() == bounds.0 * bounds.1);

    for row in 0..bounds.1 {
        for column in 0..bounds.0 {
            let point = pixel_to_point(bounds, (column, row),
                                       upper_left, lower_right);
            pixels[row * bounds.0 + column] =
                match escape_time(point, 255) {
                    None => 0,
                    Some(count) => 255 - count as u8
                };
        }
    }
}
```
### Writing Image Files
The `image` crate supports reading, writing, and basic manipulation of various image formats,
including PNG, which this program uses to save the final output. To use `image`, add this line to the `[dependencies]` section of `Cargo.toml`:
```toml
image = "0.13.0"
```
with that in place we can write:
```rust

use image::ColorType;
use image::png::PNGEncoder;
use std::fs::File;

fn write_image(filename: &str, pixels: &[u8], bounds: (usize, usize))
    -> Result<(), std::io::Error>
{
    let output = File::create(filename)?;

    let encoder = PNGEncoder::new(output);
    encoder.encode(pixels,
                   bounds.0 as u32, bounds.1 as u32,
                   ColorType::Gray(8))?;

    Ok(())
}
```
### A Concurrent Mandelbrot set

All the pieces are ready, and here’s the main function. First, a non-concurrent version for simplicity:
```rust
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() != 5 {
        eprintln!("Usage: {} FILE PIXELS UPPERLEFT LOWERRIGHT",
                  args[0]);
        eprintln!("Example: {} mandel.png 1000x750 -1.20,0.35 -1,0.20",
                  args[0]);
        std::process::exit(1);
    }

    let bounds = parse_pair(&args[2], 'x')
        .expect("error parsing image dimensions");
    let upper_left = parse_complex(&args[3])
        .expect("error parsing upper left corner point");
    let lower_right = parse_complex(&args[4])
        .expect("error parsing lower right corner point");

    let mut pixels = vec![0; bounds.0 * bounds.1];

    render(&mut pixels, bounds, upper_left, lower_right);

    write_image(&args[1], &pixels, bounds)`:
        .expect("error writing PNG file");
}
```
Now, we can build and run the program in release mode to enable powerful compiler optimizations. After a few seconds, it will generate a stunning image saved as `mandel.png`.

```bash
cargo build --release
   Compiling crossbeam-queue v0.3.12
   Compiling crossbeam-channel v0.5.14
   Compiling crossbeam v0.8.4
    Finished `release` profile [optimized] target(s) in 1.06s
warning: the following packages contain code that will be rejected by a future version of Rust: bitflags v0.7.0
note: to see what the problems were, use the option `--future-incompat-report`, or run `cargo report future-incompatibilities --id 1`
➜✗ time target/release/mandelbrot  mandel.png 4000x3000 -1.20,0.35 -1,0.20
target/release/mandelbrot  mandel.png 4000x3000 -1.20,0.35 -1,0.20  3.42s user 0.01s system 99% cpu 3.429 total
```

Running this command will generate a file named `mandel.png`.
You can view it using your system’s image viewer or a web browser. If everything works, it should look like: [image](https://ibb.co/bdNqF2y)

The crossbeam crate provides a number of valuable concurrency facilities, including a scoped thread facility that does exactly what we need here. To use it, we must add the following line to our Cargo.toml file

```toml
crossbeam = "0.8"
```
Then we need to take out the single line calling render and replace it with the following

```rust
let threads = 8;
let rows_per_band = bounds.1 / threads + 1;

{
    let bands: Vec<&mut [u8]> =
        pixels.chunks_mut(rows_per_band * bounds.0).collect();
    crossbeam::scope(|spawner| {
        for (i, band) in bands.into_iter().enumerate() {
            let top = rows_per_band * i;
            let height = band.len() / bounds.0;
            let band_bounds = (bounds.0, height);
            let band_upper_left =
                pixel_to_point(bounds, (0, top), upper_left, lower_right);
            let band_lower_right =
                pixel_to_point(bounds, (bounds.0, top + height),
                               upper_left, lower_right);

            spawner.spawn(move |_| {
                render(band, band_bounds, band_upper_left, band_lower_right);
            });
        }
    }).unwrap();
}
```
Here we iterate over the pixel buffer’s bands.
The into_iter() iterator gives each iteration of the loop body exclusive ownership of one band,
ensuring that only one thread can write to it at a time
As we mentioned earlier, the crossbeam::scope call ensures that all threads have completed before it returns, meaning that it is safe to save the image to a fil0e
Finally, we spawn a thread with the closure `move |_| { ... }`. The `move` keyword indicates the closure takes ownership of the variables it uses, ensuring only it can access the mutable slice `band`. The argument list `|_|` means the closure takes one unused argument (e.g., a nested thread spawner).

### Running the Mandelbrot Plotter

Here is the final cargo.toml
```toml
[package]
name = "mandelbrot"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4.0.0"
num = "0.4.3"
image = "0.13.0"
crossbeam = "0.8.4"
```

```bash
ime target/release/actix-gcd mandel.png 4000x3000 -1.20,0.35 -1,0.20
target/release/mandelbrot  mandel.png 4000x3000 -1.20,0.35 -1,0.20  4.67s user 0.02s system 348% cpu 1.347 total

```
we use the time again to see how long the program took to run; the elaspe time was only about 1.4 second for the second run
you can verify that by commenting out the code that does so and measuring again.

