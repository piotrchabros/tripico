import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { inject } from '@vercel/analytics';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = 'tripico';

  ngOnInit(): void {
    // Initialize Vercel Web Analytics
    inject();
  }
}
